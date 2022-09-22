import { vec3 } from 'gl-matrix';

export default function Orbit( renderer, camera, useKeyboard=true ){
    let evtChange = null;

    const state = { target : [0,0,0] };

    const ctrl   = {
        getCameraPosition : ()=>camera.position.toArray(),
        getCameraRotation : ()=>camera.quaternion.toArray(),
        getCameraFov      : ()=>camera.fov,
        getTarget         : ()=>state.target.slice(),
        onChange          : fn=>{ evtChange = fn; return ctrl; },
        enable            : ()=>{ 
            eMouse.enable();
            if( eKBoard ) eKBoard.enable();
            return ctrl;
        },
        disable           : ()=>{ 
            eMouse.disable();
            if( eKBoard ) eKBoard.disable();
            return ctrl;
        },

        // Uses Polar Coordinates to define the rotation around a target
        setOrbit : ( dLon, dLat, radius=null )=>{
            const lat   = dLat > 89.999999 ? 89.999999 : dLat < -89.999999 ? -89.999999 : dLat;
            const cpos  = camera.position.toArray();
            const polar = polar2cartesian( dLon, lat, ( radius || vec3.distance( cpos, state.target )) );

            camera.quaternion.fromArray( quatLook( [0,0,0,1], polar, [0,1,0] ) );
            camera.position.fromArray( vec3.add( [0,0,0], polar, state.target ) );

            if( evtChange ) evtChange();
            return ctrl;
        },

        // Set the distance between the camera & target ( Zooming )
        setDistance( dist ){
            const cPos = camera.position.toArray();
            const pos  = [0,0,0];

            vec3.sub( pos, cPos, state.target );
            vec3.normalize( pos, pos );
            vec3.scale( pos, pos, dist );
            vec3.add( pos, pos, state.target );

            camera.position.fromArray( pos );

            if( evtChange ) evtChange();
            return ctrl;
        },

        // Set the look at Target position for the camera as it orbits this point
        setTarget( pos ){
            const cPos = camera.position.toArray();
            const dir  = vec3.sub( [0,0,0], cpos, state.target );
            vec3.copy( state.target, pos );

            camera.quaternion.fromArray( quatLook( [0,0,0,1], dir, [0,1,0] ) );
            camera.position.fromArray( vec3.add( [0,0,0], dir, pos ) );

            if( evtChange ) evtChange();
            return this;
        },

        // Do Pan movement on the camera while keeping the target locked in step.
        setPan( pos ){
            const cPos = camera.position.toArray();
            const dir  = vec3.sub( [0,0,0], state.target, cPos );

            camera.position.fromArray( pos );
            vec3.add( state.target, pos, dir );

            if( evtChange ) evtChange();
            return this;
        }
    };

    const eMouse  = MouseEvents( state, ctrl, renderer.domElement );
    const eKBoard = ( useKeyboard ) ? KeyboardEvents( state, ctrl ) : null;
    
    return ctrl;
}


function MouseEvents( state, ctrl, canvas ){
    // #region SETTING DEFAULTS
    state.orbitScale  = 0.2;   // Scale the Delta Mouse Movements when applied to Orbit rotation
    state.wheelScale  = 0.01;  // Scale mouse wheel input used for zoom
    state.minDistance = 0.4;   // Minimum distance to travel while zooming
    state.zoomBoost   = 10;
    // #endregion

    // #region HELPERS
    const mouseCoord = e=>{
        const rect = canvas.getBoundingClientRect(); // need canvas sceen location & size
        const x    = e.clientX - rect.x; // canvas x position
        const y    = e.clientY - rect.y; // canvas y position
        return [x, y];
    }
    // #endregion
    
    // #region HANDLERS
    let initCamPos; 
    let initPolar;
    let initCoord;
    let initDistance;
    let pointerId;
    
    const onPointerDown = e=>{
        //e.stopPropagation();
        // // If disabled OR Ctrl, Shift or Alt keys are down, dont allow dragging to modify camera
        // if( !this.enabled || e.ctrlKey || e.shiftKey || e.altKey ) return;
        pointerId   = e.pointerId;

        initCamPos  = ctrl.getCameraPosition();
        const toCam = vec3.sub( [0,0,0], initCamPos, state.target );
        initPolar   = cartesian2polar( toCam );
        initCoord   = mouseCoord( e );

        // There is a slight distance drift when computing distance for each frame while orbiting
        // Fix this dift by pre computing the distance on drag start & using that as the radius for orbit.
        initDistance = vec3.distance( initCamPos, state.target );

        canvas.addEventListener( 'pointermove', onPointerMove, true );
        canvas.addEventListener( 'pointerup',   onPointerUp,   true );
    };

    const onPointerUp = e=>{
        canvas.releasePointerCapture( pointerId );
        canvas.removeEventListener( 'pointermove', onPointerMove, true );
        canvas.removeEventListener( 'pointerup',   onPointerUp,   true );
    };

    const onPointerMove = e=>{
        canvas.setPointerCapture( pointerId ); // Keep receiving events
        // e.preventDefault();
        // e.stopPropagation();

        const coord = mouseCoord( e );
        const dx    = coord[ 0 ] - initCoord[ 0 ];
        const dy    = coord[ 1 ] - initCoord[ 1 ];

        if( !e.shiftKey ){

            // ORBIT
            const px = initPolar[ 0 ] + dx * -state.orbitScale;
            const py = initPolar[ 1 ] + dy * state.orbitScale;
            ctrl.setOrbit( px, py, initDistance );

        }else{
            
            // PAN
            const rot   = ctrl.getCameraRotation();
            const uDir  = vec3.transformQuat( [0,0,0], [0,1,0], rot );  // Up Direction
            const rDir  = vec3.transformQuat( [0,0,0], [1,0,0], rot );  // Right Direction
            const pos   = initCamPos.slice();

            // Scale movement in relation to the distance the camera is to the target
            let   step  = vec3.distance( ctrl.getCameraPosition(), state.target ); // Get Camera Distance
            step       *= Math.tan( ctrl.getCameraFov() * 0.5 * Math.PI / 180 );   // Scale distance by angle of view port
            step       /= canvas.clientHeight;                                     // Scale more my view port height

            vec3.scaleAndAdd( pos, pos, uDir,  dy * step );
            vec3.scaleAndAdd( pos, pos, rDir, -dx * step );
            ctrl.setPan( pos );

        }
    };

    const onWheel = e=>{
        const cPos = ctrl.getCameraPosition();

        if( !e.altKey ){
            // ZOOM
            const boost = e.shiftKey ? state.zoomBoost : 1;
            let dist = vec3.len( vec3.sub( [ 0,0,0 ], cPos, state.target ) ); // Direction from Target to Camera
            dist     = Math.max( state.minDistance, dist + e.deltaY * state.wheelScale * boost );

            ctrl.setDistance( dist );
        }else{
            // ORBIT
            const boost = e.shiftKey ? 5 : 1;
            const toCam = vec3.sub( [0,0,0], cPos, state.target);
            const polar = cartesian2polar( toCam );
            polar[0]   += Math.sign( e.deltaY ) * 4 * boost;

            ctrl.setOrbit( polar[0], polar[1] );
        }
    };
    // #endregion

    // #region MAIN
    let isEnabled = false;

    const self = {
        enable : ()=>{
            if( isEnabled ) return self;

            canvas.addEventListener( 'wheel', onWheel, true );
            canvas.addEventListener( 'pointerdown', onPointerDown, true );

            isEnabled = true;
            return self;
        },

        disable : ()=>{
            if( !isEnabled ) return self;
            
            canvas.releasePointerCapture( pointerId );
            canvas.removeEventListener( 'wheel',       onWheel,       true );
            canvas.removeEventListener( 'pointerdown', onPointerDown, true );
            canvas.removeEventListener( 'pointermove', onPointerMove, true );
            canvas.removeEventListener( 'pointerup',   onPointerUp,   true );

            isEnabled = false;
            return self;
        },
    };

    return self.enable();
    // #endregion
}


function KeyboardEvents( state, ctrl ){
    // #region SETTINGS
    state.walkSpeed   = 0.2;
    state.kbOrbitStep = 4;
    // #endregion

    // #region MOVEMENT
    const walk = ( x, y )=>{
        const rot = ctrl.getCameraRotation();
        const pos = ctrl.getCameraPosition();
        const fwd = vec3.transformQuat( [0,0,0], [0,0,-1], rot );
        const rit = vec3.cross( [0,0,0], fwd, [0,1,0] );
        vec3.cross( fwd, [0,1,0], rit );    // Flatten forward to XZ plane

        vec3.scaleAndAdd( pos, pos, fwd, y * state.walkSpeed );
        vec3.scaleAndAdd( pos, pos, rit, x * state.walkSpeed );

        ctrl.setPan( pos );
    };

    const vertical = ( y )=>{
        const pos = ctrl.getCameraPosition();
        vec3.scaleAndAdd( pos, pos, [0,1,0], y * state.walkSpeed );
        ctrl.setPan( pos );
    };

    const orbit = ( x, y )=>{
        const cPos  = ctrl.getCameraPosition();
        const toCam = vec3.sub( [0,0,0], cPos, state.target );
        const polar = cartesian2polar( toCam );

        ctrl.setOrbit( 
            polar[ 0 ] + x * state.kbOrbitStep, 
            polar[ 1 ] + y * state.kbOrbitStep
        );
    }
    // #endregion


    // #region HANDLERS
    const keyFilter = [ 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight' ];
    const keys      = new Map(); // State of a key press, lets user hold down multiple buttons

    const onKeyDown = e=>{
        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        if( keyFilter.indexOf( e.key ) === -1 ) return;
        keys.set( e.key, true );
        
        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        let x        = 0; // If not zero, defines if going left (-1) or right(1)
        let y        = 0; // If not zero, defines if going Forward(-1) or backwards(1)

        // WHICH KEYS ARE PRESSED DOWN
        if( keys.get('ArrowUp') )    y += 1;
        if( keys.get('ArrowDown') )  y -= 1;
        if( keys.get('ArrowLeft') )  x -= 1;
        if( keys.get('ArrowRight') ) x += 1;

        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        if( x === 0 && y === 0 ) return;
        else if( e.shiftKey )    vertical( y );
        else if( e.ctrlKey )     orbit( x, y );
        else                     walk( x, y );
    };

    const onKeyUp = e=>{
        if( !keys.has( e.key ) ) return;
        keys.set( e.key, false );
    };
    // #endregion

    // #region MAIN
    let isEnabled = false;

    const self = {
        enable : ()=>{
            if( isEnabled ) return self;

            document.addEventListener( 'keydown', onKeyDown, true );
            document.addEventListener( 'keyup',   onKeyUp,   true );

            isEnabled = true;
            return self;
        },

        disable : ()=>{
            if( !isEnabled ) return self;
            
            document.removeEventListener( 'keydown', onKeyDown, true );
            document.removeEventListener( 'keyup',   onKeyUp,   true );

            isEnabled = false;
            return self;
        },
    };

    return self.enable();
    // #endregion
}


// #region MATH FUNCS
function polar2cartesian( lon, lat, radius ){
    const phi   = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    const sPhi  = Math.sin(phi);

    return [
        -(radius * sPhi * Math.sin(theta)),
        radius * Math.cos(phi),
        -(radius * sPhi * Math.cos(theta)),
    ];
}
  
function cartesian2polar(v) {
    const len = Math.sqrt( v[0]**2 + v[2]**2 );
    return [
        Math.atan2( v[0], v[2] ) * (180 / Math.PI), // lon
        Math.atan2( v[1], len )  * (180 / Math.PI), // lat
    ];
}
  
// Same concept of Matrix4 lookAt function to generate a ViewMatrix
// gl-matrix doesn't have a function like this for quaternions, but written like if it was
function quatLook( out, viewDir, upDir ){
    const zAxis = vec3.copy( [0, 0, 0], viewDir);
    const xAxis = vec3.cross([0, 0, 0], upDir, zAxis);
    const yAxis = vec3.cross([0, 0, 0], zAxis, xAxis);

    vec3.normalize(xAxis, xAxis);
    vec3.normalize(yAxis, yAxis);
    vec3.normalize(zAxis, zAxis);

    // Mat3 to Quat
    const m00 = xAxis[0];
    const m01 = xAxis[1];
    const m02 = xAxis[2];
    const m10 = yAxis[0];
    const m11 = yAxis[1];
    const m12 = yAxis[2];
    const m20 = zAxis[0];
    const m21 = zAxis[1];
    const m22 = zAxis[2];
    const t = m00 + m11 + m22;

    let x = 0;
    let y = 0;
    let z = 0;
    let w = 0;
    let s = 0;

    if (t > 0.0) {
        s = Math.sqrt(t + 1.0);
        w = s * 0.5; // |w| >= 0.5
        s = 0.5 / s;
        x = (m12 - m21) * s;
        y = (m20 - m02) * s;
        z = (m01 - m10) * s;
    } else if (m00 >= m11 && m00 >= m22) {
        s = Math.sqrt(1.0 + m00 - m11 - m22);
        x = 0.5 * s; // |x| >= 0.5
        s = 0.5 / s;
        y = (m01 + m10) * s;
        z = (m02 + m20) * s;
        w = (m12 - m21) * s;
    } else if (m11 > m22) {
        s = Math.sqrt(1.0 + m11 - m00 - m22);
        y = 0.5 * s; // |y| >= 0.5
        s = 0.5 / s;
        x = (m10 + m01) * s;
        z = (m21 + m12) * s;
        w = (m20 - m02) * s;
    } else {
        s = Math.sqrt(1.0 + m22 - m00 - m11);
        z = 0.5 * s; // |z| >= 0.5
        s = 0.5 / s;
        x = (m20 + m02) * s;
        y = (m21 + m12) * s;
        w = (m01 - m10) * s;
    }

    out[0] = x;
    out[1] = y;
    out[2] = z;
    out[3] = w;
    return out;
}
// #endregion