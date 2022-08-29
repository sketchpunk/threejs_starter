import { vec3 } from 'gl-matrix';
import PROFILES from './Profiles.js';

// #region STRUCTS & MATH
class AxesState{ x = 0; y = 0; }

class ButtonState{
    value     = 0;
    isDown    = false;  // First time being pressed
    isUp      = false;  // Button released after being down for 1 frame
    isPressed = false;  // is it currently pressed.
}

function smoothStep( min, max, v ){
    //https://en.wikipedia.org/wiki/Smoothstep
    v = Math.max( 0, Math.min( 1, (v-min) / (max-min) ) );
    return v * v * ( 3 - 2 * v );
}

function smootherStep( min, max, v ){
    if ( v <= min ) return 0;
    if ( v >= max ) return 1;

    v = ( v - min ) / ( max - min );
    return v * v * v * ( v * ( v * 6 - 15 ) + 10 );
}

export function quat_mul( out, a, b ) {
    const ax = a[0], ay = a[1], az = a[2], aw = a[3],
          bx = b[0], by = b[1], bz = b[2], bw = b[3];
    out[ 0 ] = ax * bw + aw * bx + ay * bz - az * by;
    out[ 1 ] = ay * bw + aw * by + az * bx - ax * bz;
    out[ 2 ] = az * bw + aw * bz + ax * by - ay * bx;
    out[ 3 ] = aw * bw - ax * bx - ay * by - az * bz;
    return out;
}

export function vec3_add( out, a, b ){
    out[ 0 ] = a[ 0 ] + b[ 0 ];
    out[ 1 ] = a[ 1 ] + b[ 1 ];
    out[ 2 ] = a[ 2 ] + b[ 2 ];
    return out;
}

export function vec3_transformQuat( out, v, q ){
    const qx = q[0], qy = q[1], qz = q[2], qw = q[3],
            vx = v[0], vy = v[1], vz = v[2],
            x1 = qy * vz - qz * vy,
            y1 = qz * vx - qx * vz,
            z1 = qx * vy - qy * vx,
            x2 = qw * x1 + qy * z1 - qz * y1,
            y2 = qw * y1 + qz * x1 - qx * z1,
            z2 = qw * z1 + qx * y1 - qy * x1;
    out[ 0 ] = vx + 2 * x2;
    out[ 1 ] = vy + 2 * y2;
    out[ 2 ] = vz + 2 * z2;
    return out;
}
// #endregion

export default class XRController{
    // #region MAIN
    constructor( side='left' ){
        this.profile    = PROFILES[ 'oculus-touch-v3' ].hands[ side ];
        this.side       = side; // Left or Right
        this.deadZone   = 0.1;
        this.customData = null; // Custom data dev can use to store in relation to this object
        this.onUpdate   = null; // Custom func to call when controller has been updated
    
        this.btnState   = new Map();
        this.axesState  = new Map();

        // https://developer.mozilla.org/en-US/docs/Web/API/XRInputSource/gripSpace
        this.gripPos    = [ 0,0,0 ];
        this.gripRot    = [ 0,0,0,1 ];
        this.gripMat    = [ 1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1 ];

        // https://developer.mozilla.org/en-US/docs/Web/API/XRInputSource/targetRaySpace
        this.rayPos     = [ 0,0,0 ];
        this.rayRot     = [ 0,0,0,1 ];
        this.rayMat     = [ 1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1 ];
    }
    // #endregion

    // #region METHODS
    // If the Controllers are parented to a moving floor, need floor's worldspace position & rotation;
    getWorldSpaceRay( worldPos=[0,0,0], worldRot=[0,0,0,1] ){
        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        // WORLD POSITION - parent.position + ( parent.rotation * ( parent.scale * child.position ) )
        const wRayPos = [ 0, 0, 0 ];
        vec3_transformQuat( wRayPos, this.rayPos, worldRot ); // childRotatedLocalPos = parentWorldRot * childLocalPos
        vec3_add( wRayPos, worldPos, wRayPos );               // childWorldPos        = parentWorldPos + childRotatedLocalPos;
        
        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        // WORLD ROTATION - parent.rotation * child.rotation
        const wRayRot = quat_mul( [0,0,0,1], worldRot, this.rayRot );

        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        const wRayDir = vec3_transformQuat( [0,0,0], [0,0,-1], wRayRot );
        
        return {
            pos: wRayPos,
            rot: wRayRot,
            dir: wRayDir,
        };
    }
    // #endregion

    // #region GETTERS
    getAxes( name ){ return this.axesState.get( name ); }
    getButton( name ){ return this.btnState.get( name ); }
    // #endregion

    // #region UPDATING
    update( frame, inputSource, refSpace ){
        this.updateGamepadState( inputSource );
        this.updateFromPose( frame, inputSource, refSpace );
        if( this.onUpdate ) this.onUpdate( this );      
    }

    updateGamepadState( inputSrc ){
        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        const gamepad = inputSrc?.gamepad;
        const side    = inputSrc?.handedness;
        if( !gamepad || !side ) return;

        const pro = this.profile;
        
        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        // BUTTONS
        for( const [key, obj] of Object.entries( pro.buttons ) ){
            const btn = gamepad.buttons[ obj.index ];
            let   st  = this.btnState.get( key );
            if( !st ) this.btnState.set( key, (st = new ButtonState()) );   // If none existing, create it

            st.isDown    = (  btn.pressed && !st.isPressed );   // Is pressed for the first time
            st.isUp      = ( !btn.pressed &&  st.isPressed );   // Is released
            st.isPressed = btn.pressed;                         // Currently pressed or not
            st.value     = this._deadZoneValue01( btn.value );  // Buttons like triggers have a normalized value ( 0 > 1 )

            // if( st.isDown ) console.log( key, 'is down' );
            // if( st.isUp )   console.log( key, 'is up' );
        }

        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        // AXES
        for( const [key, obj] of Object.entries( pro.axes ) ){
            let st = this.axesState.get( key );
            if( !st ) this.axesState.set( key, (st = new AxesState()) );

            st.x = this._deadZoneValueNP( gamepad.axes[ obj.x.index ] );
            if( obj.y !== undefined ) st.y = this._deadZoneValueNP( gamepad.axes[ obj.y.index ] );

            //if( st.x !== 0 || st.y !== 0 ) console.log( key, st.x, st.y );
        }
    }

    updateFromPose( frame, inputSrc, refSpace ){
        let pose;

        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        // Grip Space is the orientation to allow controller models to match up
        // with with how its helt in a hand.
        pose = frame.getPose( inputSrc.gripSpace, refSpace );
        if( pose?.transform ) this._copyPose( pose, this.gripPos, this.gripRot, this.gripMat );

        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        // Ray Space is the orientation to render objects that is pointing
        // forward in relation to the hand. Use it for Raycasting origin / direction
        // or for rendering pointer lines
        pose = frame.getPose( inputSrc.targetRaySpace, refSpace );
        if( pose?.transform ) this._copyPose( pose, this.rayPos, this.rayRot, this.rayMat );
    }
    // #endregion

    // #region HELPERS
    _deadZoneValue01( v ){ return smoothStep( this.deadZone, 1, v ); }
    _deadZoneValueNP( v ){ return smoothStep( this.deadZone, 1, Math.abs( v ) ) * Math.sign( v ); }

    _copyPose( pose, pos, rot, mat ){
        pos[0] = pose.transform.position.x;
        pos[1] = pose.transform.position.y;
        pos[2] = pose.transform.position.z;

        rot[0] = pose.transform.orientation.x;
        rot[1] = pose.transform.orientation.y;
        rot[2] = pose.transform.orientation.z;
        rot[3] = pose.transform.orientation.w;

        mat[0]  = pose.transform.matrix[0];
        mat[1]  = pose.transform.matrix[1];
        mat[2]  = pose.transform.matrix[2];
        mat[3]  = pose.transform.matrix[3];
        mat[4]  = pose.transform.matrix[4];
        mat[5]  = pose.transform.matrix[5];
        mat[6]  = pose.transform.matrix[6];
        mat[7]  = pose.transform.matrix[7];
        mat[8]  = pose.transform.matrix[8];
        mat[9]  = pose.transform.matrix[9];
        mat[10] = pose.transform.matrix[10];
        mat[11] = pose.transform.matrix[11];
        mat[12] = pose.transform.matrix[12];
        mat[13] = pose.transform.matrix[13];
        mat[14] = pose.transform.matrix[14];
        mat[15] = pose.transform.matrix[15];
    }
    // #endregion
}