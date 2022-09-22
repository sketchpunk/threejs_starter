import * as THREE from 'three';

export default class PointAllocation{
    // #region MAIN
    mesh            = null;
    _capacity       = 0;                    // How many vertices possible
    _size           = 0;                    // Current amount of vertices
    _atIndex        = 0;                    // Current index to float buffers
    _initIndex      = 0;                    // Starting index for subBuffer updating
    _defaultColor   = glColor( 0x00ff00 );  // Default color to set on points
    _dirty          = false;                // If data has changed & needs to be sent to gpu

    _vertices       = null;                 // Float Array that holds point location
    _colors         = null;                 // Float Array that holds point color

    _doAutoResize     = false;

    constructor( mat, vertCnt=50, size=0.2 ){
        this.mesh          = new THREE.Points() ;
        this.mesh.material = mat || new THREE.PointsMaterial( { size: size, vertexColors: true } );
        this.resize( vertCnt, false );
        this.mesh.onBeforeRender = ()=>{ if( this._dirty ) this.updateGeometry(); }
    }
    // #endregion

    // #region GETTERS
    getPointCapacity(){ return this._capacity; }
    getSize(){ return this._size; }
    setAutoResize( b ){ this._doAutoResize = b; return this; }

    getBoundingSphere(){ return this.mesh.geometry.boundingSphere; }
    getBoundingBox(){ return this.mesh.geometry.boundingBox; }
    getPosition(){ return this.mesh.position.toArray(); }
    getRotation(){ return this.mesh.quaternion.toArray(); }

    getWorldBoundingBox( min=[0,0,0], max=[0,0,0] ){
        const box  = this.mesh.geometry.boundingBox;
        const rot  = new THREE.Quaternion();
        const pos  = new THREE.Vector3();
        const vmin = box.min.clone();
        const vmax = box.max.clone();

        this.mesh.getWorldQuaternion( rot );
        this.mesh.getWorldPosition( pos );

        vmin.applyQuaternion( rot );
        vmax.applyQuaternion( rot );
        
        min[0] = Math.min( vmin.x, vmax.x ) + pos.x;
        min[1] = Math.min( vmin.y, vmax.y ) + pos.y;
        min[2] = Math.min( vmin.z, vmax.z ) + pos.z;

        max[0] = Math.max( vmin.x, vmax.x ) + pos.x;
        max[1] = Math.max( vmin.y, vmax.y ) + pos.y;
        max[2] = Math.max( vmin.z, vmax.z ) + pos.z;
        return [ min, max ];
    }
    // #endregion

    // #region MANAGE POINTS
    reset(){
        this._atIndex   = 0;
        this._initIndex = 0;
        this._size      = 0;
        this.mesh.geometry.setDrawRange( 0, this._size );
        return this;
    }

    getByteSize(){
        const geo  = this.mesh.geometry;
        let   size = 0;
        for( const attr of Object.values( geo.attributes ) ){
            size += attr.array.byteLength;
        }
        return size;
    }

    add( pos, color=null ){
        if( this._size >= this._capacity ){
            console.log( 'PointAllocation at capacity during add.' );
            return this
        }

        const idx               = this._atIndex;
        const col               = ( color )? glColor( color ) : this._defaultColor;
        this._vertices[ idx+0 ] = pos[ 0 ];
        this._vertices[ idx+1 ] = pos[ 1 ];
        this._vertices[ idx+2 ] = pos[ 2 ];
        this._colors[ idx+0 ]   = col[ 0 ];
        this._colors[ idx+1 ]   = col[ 1 ];
        this._colors[ idx+2 ]   = col[ 2 ];

        this._atIndex += 3;
        this._size    += 1;
        this._dirty   = true;

        return this;
    }
    
    // -- Pos should be a flat 32 array with 3 floats per position
    // -- Color must already be a flat float32 array with all the values normalized by 255.
    // Instead of calling ADD for each point, this method is to reduce all those function
    // calls with just one if the data exists in a flat array state, this allows the use
    // of the set method of typeArrays that can quickly copy content from one ArrayBuffer
    // to another thus making it faster to append large chunks of points
    appendSet( pos, color=null ){
        if( this._doAutoResize ) this._autoResize( pos.length / 3 );

        this._vertices.set( pos, this._atIndex );
        if( color ) this._colors.set( color, this._atIndex );

        this._atIndex += pos.length;
        this._size    += pos.length / 3;
        this._dirty   = true;
        return this;
    }
    // #endregion

    // #region MANAGE BUFFERS
    resize( vertCnt, doCompute=true ){
        if( vertCnt <= this._capacity ) return;

        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        // Create larger typearrays to contain the data
        const fVert = new Float32Array( vertCnt * 3 );
        const fCol  = new Float32Array( vertCnt * 3 );

        // If data already exists, just copy its contents over to the new arrays
        if( this._vertices ) fVert.set( this._vertices );
        if( this._colors )   fCol.set( this._colors );
        
        this._capacity = vertCnt;
        this._vertices = fVert;
        this._colors   = fCol;
        
        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        // Do house keeping on existing geometry buffers
        if( this.mesh.geometry ){
            this.mesh.geometry.dispose();
            this.mesh.geometry = null;
        }

        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        // Build new GPU buffers
        const bVert = new THREE.Float32BufferAttribute( fVert, 3 );
        const bCol  = new THREE.Float32BufferAttribute( fCol, 3 );
        bVert.setUsage( THREE.DynamicDrawUsage );
        bCol.setUsage(  THREE.DynamicDrawUsage );

        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        // Build Geomety that will be use for rendering
        const geo = new THREE.BufferGeometry();
        geo.setAttribute( 'position', bVert );
        geo.setAttribute( 'color', bCol );
        geo.setDrawRange( 0, this._atIndex / 3 );
        geo.needsUpdate = true;

        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        if( doCompute ){
            // Needed to raycast correctly the points using 3JS's RayCaster.
            geo.computeBoundingSphere();
            geo.computeBoundingBox();
        }

        this.mesh.geometry = geo;
    }

    _autoResize( vertCnt ){ if( vertCnt + this._size > this._capacity ) this.resize( vertCnt + this._size ); }
    // #endregion

    // #region MANAGE GEOMETRY
    updateGeometry( fullUpdate=false ){
        if( !this._dirty ) return;

        const geo    = this.mesh.geometry;
        const bVert  = geo.attributes.position;
        const bCol   = geo.attributes.color;
        const rngLen = ( fullUpdate )? -1 : this._atIndex - this._initIndex;

        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        bVert.array.set( this._vertices ); //bVert.count = this._vertices.length / 3;
        bVert.updateRange.offset = this._initIndex;  // how 3js give useage of WebGL's bufferSubData functionality
        bVert.updateRange.count  = rngLen;
        bVert.needsUpdate        = true;
        
        bCol.array.set( this._colors );    //bCol.count = this._colors.length / 3;
        bCol.updateRange.offset = this._initIndex;  // how 3js give useage of WebGL's bufferSubData functionality
        bCol.updateRange.count  = rngLen;
        bCol.needsUpdate        = true;

        geo.setDrawRange( 0, this._size );  // Limit how much to render
        geo.computeBoundingBox();           // Needed for Ray casting into mesh
        geo.computeBoundingSphere();        // ....

        //console.log( ' start %d end %d len %d ', this._initIndex, this._atIndex, rngLen );
        
        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        this._initIndex = this._atIndex;    // Next Batch starts at the current index
        this._dirty     = false;            // Data no longer dirty
    }
    // #endregion
}

function glColor( hex, out = null ){
    const NORMALIZE_RGB = 1 / 255;
    out = out || [0,0,0];

    out[0] = ( hex >> 16 & 255 ) * NORMALIZE_RGB;
    out[1] = ( hex >> 8 & 255 )  * NORMALIZE_RGB;
    out[2] = ( hex & 255 )       * NORMALIZE_RGB;

    return out;
}