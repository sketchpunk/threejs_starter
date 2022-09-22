//import * as THREE from 'three';

// #region MATHS
function vec3_norm( out, a ){
    let mag = Math.sqrt( a[ 0 ]**2 + a[ 1 ]**2 + a[ 2 ]**2 );
    if( mag != 0 ){
        mag      = 1 / mag;
        out[ 0 ] = a[ 0 ] * mag;
        out[ 1 ] = a[ 1 ] * mag;
        out[ 2 ] = a[ 2 ] * mag;
    }
    return out;
}
// #endregion

// Events : newSession, xrStart, xrEnd
export default class XRManager{
    // #region MAIN
    isActive = false;   // Has xrStart event been triggered yet
    session  = null;    // Reference to XR Session given by browser
    renderer = null;    // Threejs Renderer
    camera   = null;
    xrCamera = null;
    refSpace = null;    // Reference Space : https://developer.mozilla.org/en-US/docs/Web/API/XRReferenceSpace
    frame    = null;    // https://developer.mozilla.org/en-US/docs/Web/API/XRFrame

    constructor( renderer, camera ){ 
        this.renderer = renderer;
        this.camera   = camera;
    }
    // #endregion

    // #region XR Position & Orientation
    updateXRCamera(){
        this.xrCamera = this.renderer.xr.getCamera();
        this.xrCamera.updateWorldMatrix( true, false );
        return this;
    }

    getXRProjectionMatrix(){ return this.xrCamera.projectionMatrix.elements; }

    getXRWorldPosition( out=[0,0,0] ){
        const elm = this.xrCamera.matrixWorld.elements;
        out[ 0 ]  = elm[ 12 ];
        out[ 1 ]  = elm[ 13 ];
        out[ 2 ]  = elm[ 14 ];
        return out;
    }

    getXRWorldForward( out=[0,0,0] ){
        const elm = this.xrCamera.matrixWorld.elements;
        out[ 0 ]  = -elm[ 8 ];
        out[ 1 ]  = -elm[ 9 ];
        out[ 2 ]  = -elm[ 10 ];
        return vec3_norm( out, out );
    }

    getXRWorldAxis( x=[0,0,0], y=[0,0,0], z=[0,0,0] ){
        const elm = this.xrCamera.matrixWorld.elements;
        
        x[ 0 ] = elm[ 0 ];
        x[ 1 ] = elm[ 1 ];
        x[ 2 ] = elm[ 2 ];
        vec3_norm( x, x );

        y[ 0 ] = elm[ 4 ];
        y[ 1 ] = elm[ 5 ];
        y[ 2 ] = elm[ 6 ];
        vec3_norm( y, y );
         
        // VR Camera's forward is negative z direction
        z[ 0 ] = -elm[ 8 ];  
        z[ 1 ] = -elm[ 9 ];
        z[ 2 ] = -elm[ 10 ];
        vec3_norm( z, z );

        //return [ x, y, z ];
    }

    getXRWorldRotation( out=[0,0,0,1] ){
        // Matrix3 Rotation to quaternion conversion
        // Since there is no scaling added to the XR Matrix the 3 
        // axes should be normalized when plucking from the matrix
        const elm = this.xrCamera.matrixWorld.elements;
        const m00 = elm[0], m01 = elm[1], m02 = elm[2],     // x axis
              m10 = elm[4], m11 = elm[5], m12 = elm[6],     // y axis
              m20 = elm[8], m21 = elm[9], m22 = elm[10],    // z axis
              t = m00 + m11 + m22;
        let x, y, z, w, s;

        if(t > 0.0){
            s = Math.sqrt(t + 1.0);
            w = s * 0.5 ; // |w| >= 0.5
            s = 0.5 / s;
            x = (m12 - m21) * s;
            y = (m20 - m02) * s;
            z = (m01 - m10) * s;
        }else if((m00 >= m11) && (m00 >= m22)){
            s = Math.sqrt(1.0 + m00 - m11 - m22);
            x = 0.5 * s;// |x| >= 0.5
            s = 0.5 / s;
            y = (m01 + m10) * s;
            z = (m02 + m20) * s;
            w = (m12 - m21) * s;
        }else if(m11 > m22){
            s = Math.sqrt(1.0 + m11 - m00 - m22);
            y = 0.5 * s; // |y| >= 0.5
            s = 0.5 / s;
            x = (m10 + m01) * s;
            z = (m21 + m12) * s;
            w = (m20 - m02) * s;
        }else{
            s = Math.sqrt(1.0 + m22 - m00 - m11);
            z = 0.5 * s; // |z| >= 0.5
            s = 0.5 / s;
            x = (m20 + m02) * s;
            y = (m21 + m12) * s;
            w = (m01 - m10) * s;
        }

        out[ 0 ] = x;
        out[ 1 ] = y;
        out[ 2 ] = z;
        out[ 3 ] = w;
        return out;
        
        /*
        // https://github.com/mrdoob/three.js/blob/master/src/math/Matrix4.js#L710
        // Matrix Decompose, only need quaternion part
        // This requires extra threejs reference & objects to work.
        const te = this.xrCamera.matrixWorld.elements;
        const _v1 = new THREE.Vector3();

        let sx   = _v1.set( te[ 0 ], te[ 1 ], te[ 2 ] ).length();
        const sy = _v1.set( te[ 4 ], te[ 5 ], te[ 6 ] ).length();
        const sz = _v1.set( te[ 8 ], te[ 9 ], te[ 10 ] ).length();

        // if determine is negative, we need to invert one scale
        const det = this.xrCamera.matrixWorld.determinant();
        if ( det < 0 ) sx = - sx;

        // scale the rotation part
        const _m1 = new THREE.Matrix4();
        _m1.copy( this.xrCamera.matrixWorld );

        const invSX = 1 / sx;
        const invSY = 1 / sy;
        const invSZ = 1 / sz;

        _m1.elements[ 0 ] *= invSX;
        _m1.elements[ 1 ] *= invSX;
        _m1.elements[ 2 ] *= invSX;

        _m1.elements[ 4 ] *= invSY;
        _m1.elements[ 5 ] *= invSY;
        _m1.elements[ 6 ] *= invSY;

        _m1.elements[ 8 ] *= invSZ;
        _m1.elements[ 9 ] *= invSZ;
        _m1.elements[ 10 ] *= invSZ;

        return new THREE.Quaternion().setFromRotationMatrix( _m1 ).toArray();
        */
    }
    // #endregion

    // #region GETTERS
    async isAvailable(){
        if( 'xr' in navigator ){
            return await navigator.xr.isSessionSupported( 'immersive-vr' );
        }
        return false;
    }
    // #endregion

    // #region SESSION
    endSession(){ if( this.session ){ this.session.end(); this.session = null; } }
    
    async requestSession(){
        if( ! await this.isAvailable() ){   console.log( 'Browser has no support for WebXR' );
        }else if( this.session ){           console.log( 'Session already opened' );
        }else{
            try{
                // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                // Get session
                const session = await navigator.xr.requestSession( 'immersive-vr', { 
                    optionalFeatures: [ 'local-floor', 'bounded-floor', 'hand-tracking', 'layers' ]
                } );
                
                // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                // Session setups
                this.session    = session;
                this.refSpace   = await session.requestReferenceSpace( 'local-floor' );

                session.addEventListener( 'end', ( e )=>{
                    console.log( 'Session Ended' );
                    this.isActive = false;
                } );

                // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                // Give session to 3JS
                this.renderer.xr.setSession( this.session );

                this.emit( 'newSession', session );
                return true;
            }catch( ex ){
                console.log( 'error', ex );
            }
        }

        return false;
    }
    // #endregion

    // #region EVENTS
    onRender( frame, time ){
        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        // Test when XR turns On/Off from 3JS
        if( this.renderer.xr.isPresenting && !this.isActive ){       this.isActive = true;  this.emit( 'xrStart', frame ); }
        else if( !this.renderer.xr.isPresenting && this.isActive ){  this.isActive = false; this.emit( 'xrEnd' ); }

        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        this.frame = frame;
        return this.renderer.xr.isPresenting;
    }

    // Available: end, select, selectstart, selectend, squeeze, squeezestart, squeezeend, inputsourceschange
    onSessionEvent( evtName, fn ){ this.session.addEventListener( evtName, fn ); return this; }
    
    on( evtName, fn, once=false ){ document.body.addEventListener( evtName, fn, { once } ); return this; }
    off( evtName, fn ){ document.body.removeEventListener( evtName, fn ); return this; }

    emit( evtName, payload ){
        document.body.dispatchEvent( new CustomEvent( evtName, { 
            detail      : payload,
            bubbles     : false,
            cancelable  : true,
            composed    : false,
        }) );
        return this;
    }
    // #endregion
}