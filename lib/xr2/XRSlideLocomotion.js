import { Quaternion, Vector3 } from 'three';

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

export default class XRSlideLocomotion{
    // #region MAIN
    constructor( xrMan, xrInput, target ){
        this.xrMan      = xrMan;
        this.xrInput    = xrInput;
        this.target     = target;

        this.xAxis      = [0,0,0];
        this.yAxis      = [0,0,0];
        this.zAxis      = [0,0,0];

        this.zSpring    = new SpringIEFloat( 0.3 );
        this.xSpring    = new SpringIEFloat( 0.3 );
        this.tSpring    = new SpringIEFloat( 0.5 );

        this.maxSpeedForward = 0.18;
        this.maxSpeedRight   = 0.15;
        this.maxSpeedTwist   = 0.8 * Math.PI / 180;
    }
    // #endregion

    // #region METHODS
    update( dt ){
        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        // Get the direction the XR camera is point
        this.xrMan.updateXRCamera();
        this.xrMan.getXRWorldAxis( this.xAxis, this.yAxis, this.zAxis );

        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        this.handleRightCtrl( dt );
        this.handleLeftCtrl( dt );
    }
    // #endregion

    // #region LOGIC
    handleRightCtrl( dt ){
        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        const ctrl = this.xrInput.getRightController();
        if( !ctrl ) return;

        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        // Clamp to XZ Plane: Alternative - fwd = cross( world.up, camera.RightDirection ).normalize()
        const zDir = this.zAxis.slice();
        const xDir = this.xAxis.slice();
        zDir.y = 0;
        xDir.y = 0;
        vec3_norm( zDir, zDir );
        vec3_norm( xDir, xDir );

        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        const joy = ctrl.getAxes( 'joystick' );

        // Target speeds
        let zScl = -joy.y * this.maxSpeedForward;
        let xScl =  joy.x * this.maxSpeedRight;

        // Apply velocity
        this.zSpring.update( dt, zScl );
        this.xSpring.update( dt, xScl );
        zScl = this.zSpring.value;
        xScl = this.xSpring.value;

        // Move Object3D
        this.target.position.x += zDir[ 0 ] * zScl + xDir[ 0 ] * xScl;
        //this.target.position.y += zDir[ 1 ] * zScl + xDir[ 1 ] * xScl;
        this.target.position.z += zDir[ 2 ] * zScl + xDir[ 2 ] * xScl;
    }

    handleLeftCtrl( dt ){
        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        const ctrl = this.xrInput.getLeftController();
        if( !ctrl ) return;

        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        const joy = ctrl.getAxes( 'joystick' );
        let tScl = joy.x * this.maxSpeedTwist;
        this.tSpring.update( dt, tScl );

        if( this.tSpring.value !== 0 ){
            const q = new Quaternion();
            q.setFromAxisAngle( new Vector3( 0, 1, 0 ), -this.tSpring.value );
            this.target.quaternion.multiply( q );
        }
    }
    // #endregion
}


class SpringIEFloat{
    // #region MAIN
    osc_ps  = Math.PI * 2;  // Oscillation per Second : How many Cycles (Pi*2) per second.	
    damping = 1;            // How much to slow down : Value between 0 and 1. 1 creates critical damping.
    epsilon = 0.0001;
    vel     = 0;            // Velocity
    value   = 0;            // Current Value
    tar     = 0;            // Target Value

    constructor( sec=null ){
        if( sec !== null ) this.setOscPs( sec );
    }
    // #endregion

    // #region SETTERS / GETTERS
    setOscPs( sec ){    this.osc_ps = Math.PI * 2 * sec; return this; }
    setDamp( damping ){ this.damping = damping; return this; }
    
    // Damp Time, in seconds to damp. So damp 0.5 for every 2 seconds.
    // With the idea that for every 2 seconds, about 0.5 damping has been applied
    setDampRatio( damping, dampTimeSec ){ this.damping = Math.log( damping ) / ( -this.osc_ps * dampTimeSec ); return this; }
    
    // Reduce oscillation by half in X amount of seconds
    setDampHalflife( dampTimeSec ){
        this.damping = 0.6931472 / ( this.osc_ps * dampTimeSec ); // float zeta = -ln(0.5f) / ( omega * lambda );
        return this;
    }

    // Critical Damping with a speed control of how fast the cycle to run
    setDampExpo( dampTimeSec ){
        this.osc_ps  = 0.6931472 / dampTimeSec; // -Log(0.5) but in terms of OCS its 39.7 degrees over time
        this.damping = 1;
        return this
    }

    setTarget( v ){ this.tar = v; return this; }
    // #endregion

    // #region METHODS
    update( dt, newTar=null ){
        if( newTar !== null ) this.tar = newTar;

        if( this.vel === 0 && this.tar === this.value ) return false;

        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        if ( Math.abs( this.vel ) < this.epsilon && Math.abs( this.tar - this.value ) < this.epsilon ) {
            this.vel   = 0;
            this.value = this.tar;
            return true;
        }
        
        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        const friction = 1.0 + 2.0 * dt * this.damping * this.osc_ps,
              dt_osc   = dt * this.osc_ps**2,
              dt2_osc  = dt * dt_osc,
              det_inv  = 1.0 / ( friction + dt2_osc );

        this.vel   = ( this.vel + dt_osc * ( this.tar - this.value ) ) * det_inv;
        this.value = ( friction * this.value + dt * this.vel + dt2_osc * this.tar ) * det_inv;
        
        return true;
    }

    reset( v=null ){
        this.vel = 0;

        if( v != null ){
            this.value   = v;
            this.tar     = v;
        }else{
            this.value   = 0;
            this.tar     = 0;
        }
        return this;
    }
    // #endregion
}