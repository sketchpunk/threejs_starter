import { vec3, quat } from 'gl-matrix'

/*
// use projMatrix * viewMatrix as the matrix with the following to get
// the plane normals rotated correctly for the camera but things will be in viewSpace I believe
// This is a more efficent way to get normals, Maybe a way to modify  to work in world space
const me = m.elements;
const me0 = me[ 0 ], me1 = me[ 1 ], me2 = me[ 2 ], me3 = me[ 3 ];
const me4 = me[ 4 ], me5 = me[ 5 ], me6 = me[ 6 ], me7 = me[ 7 ];
const me8 = me[ 8 ], me9 = me[ 9 ], me10 = me[ 10 ], me11 = me[ 11 ];
const me12 = me[ 12 ], me13 = me[ 13 ], me14 = me[ 14 ], me15 = me[ 15 ];

// Just planes normals * constant
planes[ 0 ].setComponents( me3 - me0, me7 - me4, me11 - me8, me15 - me12 ).normalize();
planes[ 1 ].setComponents( me3 + me0, me7 + me4, me11 + me8, me15 + me12 ).normalize();
planes[ 2 ].setComponents( me3 + me1, me7 + me5, me11 + me9, me15 + me13 ).normalize();
planes[ 3 ].setComponents( me3 - me1, me7 - me5, me11 - me9, me15 - me13 ).normalize();
planes[ 4 ].setComponents( me3 - me2, me7 - me6, me11 - me10, me15 - me14 ).normalize();
planes[ 5 ].setComponents( me3 + me2, me7 + me6, me11 + me10, me15 + me14 ).normalize();
*/

class Plane{
    // #region MAIN
    constructor( pos=null, norm=null){
        this.pos    = [ 0, 0, 0 ];
        this.norm   = [ 0, 0, 0 ];
        this.d      = 0;            // constant term: d = -(a*x0 + b*y0 + c*z0)

        if( pos && norm ) this.set( pos, norm );
    }
    // #endregion

    // #region SETTERS
    set( pos, norm ){
        vec3.copy( this.pos, pos );
        vec3.copy( this.norm, norm );
        this.d = -vec3.dot( norm, pos );
        return this;
    }

    fromTriangle( a, b, c ){
        const ab    = vec3.sub( [0,0,0], a, b );
        const cb    = vec3.sub( [0,0,0], c, b );
        const norm  = vec3.cross( [0,0,0], cb, ab );
        vec3.normalize( norm, norm );

        this.set( a, norm );
		return this;
    }

    fromQuad( lt, lb, rb, rt ){
        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        // Compute Midpoint of quad
        vec3.add( this.pos, lt, lb );
        vec3.add( this.pos, this.pos, rb );
        vec3.add( this.pos, this.pos, rt );
        vec3.scale( this.pos, this.pos, 0.25 );

        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        // Compute outward normal
        const a = vec3.sub( [0,0,0], rt, lt );
        const b = vec3.sub( [0,0,0], lb, lt );

        vec3.cross( this.norm, b, a );
        vec3.normalize( this.norm, this.norm );

        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        this.d = -vec3.dot( this.norm, this.pos );
        return this;
    }
    // #endregion

    // #region METHODS
    negate(){
        this.norm[ 0 ]  = -this.norm[ 0 ];
        this.norm[ 1 ]  = -this.norm[ 1 ];
        this.norm[ 2 ]  = -this.norm[ 2 ];
        this.d          = -this.d;
    }

    pointDistance( p ){ return vec3.dot( this.norm, pnt ) + this.d; }
    sphereDistance( c, radius ){ return vec3.dot( this.norm, c ) + this.d - radius; }
    
    projectPoint( p, out=[0,0,0] ){
        const dist = this.pointDistance( p );
        return vec3.scaleAndAdd( out, p, this.norm, -dist );
    }
    // #endregion
}

export default class Frustum{
    // #region MAIN
    constructor(){
        // LT, LB, RB, RT
        // 0 --- 3
        // |     |
        // 1 --- 2
        this.nearPoints = [ [0,0,0], [0,0,0], [0,0,0], [0,0,0] ];
        this.farPoints  = [ [0,0,0], [0,0,0], [0,0,0], [0,0,0] ];

        // 0:right, 1:bottom, 2:left, 3:top, 4:near, 5:far
        this.planes     = [
            new Plane(), new Plane(), new Plane(),
            new Plane(), new Plane(), new Plane(),
        ];

        this.pos        = [ 0,0,0 ];
        this.rot        = [ 0,0,0,1 ];
        this.near       = 0;
        this.far        = 10;
        this.ratio      = 1;
        this.fov        = 45;

        this.near_w     = 0;    // Near Half Width
        this.near_h     = 0;    // Near Half height
        this.far_w      = 0;    // Far Half Width
        this.far_h      = 0;    // Far Half Height
    }
    // #endregion

    // #region SETTERS
    setCamera( fovDeg, near, far, ratio ){
        this.fov    = fovDeg * Math.PI / 180;
        this.near   = near;
        this.far    = far;
        this.ratio  = ratio;

        const ang   = 2 * Math.tan( this.fov / 2 );    // Angle
        
        this.near_h = ang * this.near * 0.5;           // Near Half Height
        this.near_w = this.near_h * this.ratio;        // Near Half Width
        this.far_h  = ang * this.far * 0.5;            // Far Half Height
        this.far_w  = this.far_h * this.ratio;         // Far Half Width

        return this;
    }

    setFromProjection( proj, near=0, far=0 ){
        const topFov    = ( proj[ 9 ] + 1 ) / proj[ 5 ]; // const bottomFov = ( proj[ 9 ] - 1 ) / proj[ 5 ];
        const rightFov  = ( proj[ 8 ] + 1 ) / proj[ 0 ]; // const leftFov   = ( proj[ 8 ] - 1 ) / proj[ 0 ];

        this.near       = near || proj[ 14 ] / ( proj[ 10 ] - 1 );
	    this.far        = far  || proj[ 14 ] / ( proj[ 10 ] + 1 );
        this.near_w     = this.near * rightFov
        this.near_h     = this.near * topFov;
        this.far_w      = this.far  * rightFov;
        this.far_h      = this.far  * topFov;
        return this;
    }

    setPosition( p ){ vec3.copy( this.pos, p ); return this; }
    setRotation( r ){ quat.copy( this.rot, r ); return this; }
    // #endregion

    // #region METHODS
    update(){
        const xAxis  = vec3.transformQuat( [0,0,0], [1,0,0], this.rot );
        const yAxis  = vec3.transformQuat( [0,0,0], [0,1,0], this.rot );
        const zAxis  = vec3.transformQuat( [0,0,0], [0,0,-1], this.rot ); // Camera points in -Z

        const yAxisH = [0,0,0];
        const xAxisH = [0,0,0];
        const v      = [0,0,0];

        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        // NEAR PLANE POINTS
        vec3.scale( xAxisH, xAxis, this.near_w );   // Half Axis Dir
        vec3.scale( yAxisH , yAxis, this.near_h );  // Half Axis Dir
        vec3.scale( v, zAxis, this.near );          // Plane Center...
        vec3.add( v, v, this.pos );   

        vec3.sub( this.nearPoints[ 0 ], vec3.add( this.nearPoints[ 0 ], v, yAxisH ), xAxisH ); // tl = ncenter + (up * Hnear/2) - (right * Wnear/2)
        vec3.sub( this.nearPoints[ 1 ], vec3.sub( this.nearPoints[ 1 ], v, yAxisH ), xAxisH ); // bl = ncenter - (up * Hnear/2) - (right * Wnear/2)
        vec3.add( this.nearPoints[ 2 ], vec3.sub( this.nearPoints[ 2 ], v, yAxisH ), xAxisH ); // br = ncenter - (up * Hnear/2) + (right * Wnear/2)
        vec3.add( this.nearPoints[ 3 ], vec3.add( this.nearPoints[ 3 ], v, yAxisH ), xAxisH ); // tr = ncenter + (up * Hnear/2) + (right * Wnear/2)

        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        // FAR PLANE POINTS
        vec3.scale( xAxisH, xAxis, this.far_w );   // Half Axis Dir
        vec3.scale( yAxisH, yAxis, this.far_h );   // Half Axis Dir
        vec3.scale( v, zAxis, this.far );          // Plane Center...
        vec3.add( v, v, this.pos );
                
        vec3.sub( this.farPoints[ 0 ], vec3.add( this.farPoints[ 0 ], v, yAxisH ), xAxisH ); // ftl = fc + (up * Hfar/2) - (right * Wfar/2)
        vec3.sub( this.farPoints[ 1 ], vec3.sub( this.farPoints[ 1 ], v, yAxisH ), xAxisH ); // fbl = fc - (up * Hfar/2) - (right * Wfar/2)
        vec3.add( this.farPoints[ 2 ], vec3.sub( this.farPoints[ 2 ], v, yAxisH ), xAxisH ); // fbr = fc - (up * Hfar/2) + (right * Wfar/2)
        vec3.add( this.farPoints[ 3 ], vec3.add( this.farPoints[ 3 ], v, yAxisH ), xAxisH ); // ftr = fc + (up * Hfar/2) + (right * Wfar/2)

        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        // Planes
        const fp = this.farPoints;
        const np = this.nearPoints;

        this.planes[ 4 ].fromQuad( np[0], np[1], np[2], np[3] );  // Z+ use np[3], np[2], np[1], np[0]
        this.planes[ 5 ].fromQuad( fp[3], fp[2], fp[1], fp[0]  ); // Z+ use fp[0], fp[1], fp[2], fp[3]

        for( let i=0; i < 4; i++ ){
            const ii = ( i + 1 ) % 4;
            this.planes[ i ].fromQuad( fp[i], fp[ii], np[ii], np[i] ); // Z+ use np[i], np[ii], fp[ii], fp[i]
        }

        return this;
    }
    // #endregion

    // #region INTERSECTIONS
    // RETURN : inside 1, intersect 0, outside -1
    // https://gist.github.com/Kinwailo/d9a07f98d8511206182e50acda4fbc9b
    intersectAABB( min, max ){
        const vmin = [0,0,0];
        const vmax = [0,0,0];
        let rtn    = 1; // inside

        for( const p of this.planes ){
            const n = p.norm;

            // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
            // Find the min and max from normal
            if( n[0] > 0 ){ vmin[0] = min[0];  vmax[0] = max[0]; }
            else          { vmin[0] = max[0];  vmax[0] = min[0]; }

            if( n[1] > 0 ){ vmin[1] = min[1];  vmax[1] = max[1]; }
            else          { vmin[1] = max[1];  vmax[1] = min[1]; }

            if( n[2] > 0 ){ vmin[2] = min[2];  vmax[2] = max[2]; }
            else          { vmin[2] = max[2];  vmax[2] = min[2]; }

            // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
            // Distance check
            if( vec3.dot( n, vmin ) + p.d > 0 )  return -1; // outside
            if( vec3.dot( n, vmax ) + p.d >= 0 ) rtn = 0;   // intersects
        }

        return rtn;
    }

    // https://github.com/mrdoob/three.js/blob/master/src/math/Frustum.js#L109
    // Modified to handle frustum with plane normals pointing outward
    intersectBox( min, max ){
        const v = [0,0,0];
        for( const p of this.planes ){
            v[ 0 ] = ( p.norm[ 0 ] < 0 )? max[ 0 ] : min[ 0 ];
            v[ 1 ] = ( p.norm[ 1 ] < 0 )? max[ 1 ] : min[ 1 ];
            v[ 2 ] = ( p.norm[ 2 ] < 0 )? max[ 2 ] : min[ 2 ];

            if( vec3.dot( p.norm, v ) + p.d > 0 ) return false;
        }

        return true;
    }

    intersectSphere( pos, radius ) {
        for( const p of this.planes ){
            if( vec3.dot( p.norm, pos ) + p.d > radius ) return false;
        }
        return true;
    }

    containsPoint( pos ){
        for( const p of this.planes ){
            if( vec3.dot( p.norm, pos ) + p.d > 0 ) return false;
        }
        return true;
    }
    // #endregion
}