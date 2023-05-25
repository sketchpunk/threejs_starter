import {mat4, quat, vec3, vec4} from 'gl-matrix';

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Scale steps by distance and FOV
// let dist  = vec3.dist( this.getCameraPos(), this.targetPos );
// dist *= Math.tan( ( this.camera.getEffectiveFOV() * 0.5 ) * 0.01745329251 );
// const x   = dx * this.stepScale * dist / this.canvas.clientHeight;
// const z   = dz * this.stepScale * dist / this.canvas.clientHeight;  

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Delta * Degrees then scaled by canvas height, this makes it possible
// to rotate a whole X degrees from center to edge of screen
// const rx  = ( dx * Math.PI * sclX ) / this.canvas.clientHeight;
// const ry  = ( dy * Math.PI * sclY ) / this.canvas.clientHeight; 

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Zoom scales based on distance, alt between mul or div if zooming in or out
// const d    = vec3.dist( this.getCameraPos(), this.targetPos );
// ( tick === -1 )? d * scl : d / scl

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//x = dx * ( c.right - c.left ) / c.zoom / this.canvas.clientWidth;
//z = dz * ( c.top - c.bottom ) / c.zoom / this.canvas.clientHeight;

// #region PLANE XZ STEPPER
/** Move camera on view's axis clamped to the XZ plane */
export function panStepXZ( camera, xSteps, zSteps, initPos=null ){
    const rot = camera.quaternion.toArray();
    const pos = initPos?.slice() || camera.position.toArray();
  
    const rit = [0, 0, 0];
    const fwd = vec3.transformQuat( [0, 0, 0], [0, 0, -1], rot ); // Rotation Forward Axis
  
    if( Math.abs( vec3.dot( fwd, [0, 1, 0] ) ) < 0.9999 ){
      vec3.cross(rit, fwd, [0, 1, 0]); // Right axis clamped to XZ plane
      vec3.cross(fwd, [0, 1, 0], rit); // Clamp forward so it XZ plane
    } else {
      // Over at the poles, just compute the UP and Right axes of the camera's rotation
      vec3.transformQuat(fwd, [0, 1, 0], rot);
      vec3.transformQuat(rit, [1, 0, 0], rot);
    }
  
    // Scale directions & add starting position
    vec3.scaleAndAdd(pos, pos, fwd, zSteps);
    vec3.scaleAndAdd(pos, pos, rit, xSteps);
  
    return pos;

}
// #endregion

// #region LOOK ROTATION STEPPER

// Rotate camera for look movement. X Rotation is clamped so
// user doesn't keep rotating around, plus the final rotation
// is clamped to world up to prevent any disorientation.
export function lookStep( camera, xRad, yRad, initRot = null ){
    const rot = initRot?.slice() || camera.quaternion.toArray();
    const q   = [0, 0, 0, 1];
    const fwd = [0, 0, 0];
    
    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Compute Y Rotation
    if( yRad ){
      quat.setAxisAngle( q, [0, 1, 0], yRad );
      quat.mul( rot, q, rot );
    }
    
    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Compute X Rotation
    if( xRad ){
      // Clamp Forward to XZ Plane
      const xzDir = vec3.transformQuat( [0, 0, 0], [0, 0, 1], rot );
      xzDir[1]    = 0;
      vec3.normalize( xzDir, xzDir );
  
      // Do X Rotation
      const rit = vec3.transformQuat( [0, 0, 0], [1, 0, 0], rot );  // Local X Axis
      quat.setAxisAngle( q, rit, xRad );                            // Create Localized X Rotation in worldspace
      const rotX = quat.mul( [0, 0, 0, 1], q, rot );                // Add X rotation to Y's
  
      // Clamp Rotation between UP & DOWN
      vec3.transformQuat( fwd, [0, 0, 1], rotX );
  
      if( vec3.dot( fwd, xzDir ) < 0.01 ){
        // Dot Product of 0.01 is about 89.38 degrees
        // Compute Clamped Forward Direction
        quat.setAxisAngle( q, rit, ((89.38 * Math.PI) / 180) * Math.sign( -fwd[1] ) );
        const cFwd = vec3.transformQuat( [0, 0, 0], xzDir, q );
  
        // Rotate Fwd to Clamped Forward Direction
        quat.rotationTo(q, fwd, cFwd);
        quat.mul(rotX, q, rotX);
      }
  
      // Save clamped X Rotation as final rotation
      quat.copy( rot, rotX );
    }
  
    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Z rotation can creap in with a lot of mouse movements & build up over time.
    // Clamping rotation to world up prevents any disorentation from z rotation.
    vec3.transformQuat( fwd, [0, 0, 1], rot );
  
    return lookDirection( rot, fwd, [0, 1, 0] );
  }
  
  /** Compute rotation from a look & up direction */
  export function lookDirection( out, dir, up = [0, 1, 0] ){
    const z = dir.slice();
    const x = vec3.cross([0, 0, 0], up, z);
    const y = vec3.cross([0, 0, 0], z, x);
  
    vec3.normalize( x, x );
    vec3.normalize( y, y );
    vec3.normalize( z, z );
  
    // Format: column-major, when written out it looks like row-major
    quat.fromMat3( out, [...x, ...y, ...z] );
    return quat.normalize( out, out );
  }
// #endregion

// #region MOUSE RAY STEPPER

// Create a Ray projection from the mouse position, then move
// the camera in that direction
function mouseRayStep( e, camera, steps, initPos = null ){
    // Get the 2D coordinates of the mouse in relation to the canvas
    const canvas = e.target;
    const rect   = canvas.getBoundingClientRect();
    const coord  = [ e.clientX - rect.x, e.clientY - rect.y ];
    const pos    = initPos?.slice() || camera.position.toArray();
  
    // Project the coordinate to create a ray that will range from
    // the near & far of the camera's perspective projection
    const [ rayStart, rayEnd ] = mouseScreenProjectionRay(
        coord[0],
        coord[1],
        rect.width,
        rect.height,
        camera.projectionMatrix.toArray(),
        camera.matrixWorld.toArray(),
    );
  
    // Get a unit vector direction of where to travel
    const dir = vec3.sub( [0, 0, 0], rayEnd, rayStart );
    vec3.normalize(dir, dir);
  
    // Move camera x steps on the ray from its current position
    vec3.scaleAndAdd( pos, pos, dir, steps );
    return pos;
}
  
/** Create a ray projection from the mouse over the view port, returns [ startPos, endPos ] */
function mouseScreenProjectionRay( x, y, w, h, projMatrix, camMatrix ){
    // Normalize Device Coordinate
    const nx = (x / w) * 2 - 1;
    const ny = 1 - (y / h) * 2;
  
    // Ways to build inverse world matrix
    // inverseWorldMatrix = invert( ProjectionMatrix * ViewMatrix ) OR
    // inverseWorldMatrix = localMatrix * invert( ProjectionMatrix )
    const invMatrix = [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ];
    mat4.invert( invMatrix, projMatrix );
    mat4.mul( invMatrix, camMatrix, invMatrix );
  
    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Clip Coords would be [nx,ny,-1,1];
    const clipNear = [nx, ny, -1, 1]; // Ray Start
    const clipFar  = [nx, ny, 1, 1]; // Ray End
  
    // Using 4D homogeneous clip coordinates
    // as the input to project the mouse position
    // into the 3d space.
    vec4.transformMat4( clipNear, clipNear, invMatrix );
    vec4.transformMat4( clipFar, clipFar, invMatrix );
  
    // Normalize by using W component
    for (let i = 0; i < 3; i++) {
        clipNear[i] /= clipNear[3];
        clipFar[i]  /= clipFar[3];
    }
  
    // Remove W component to return only XYZ ( Vec3 )
    clipNear.pop();
    clipFar.pop();
  
    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    return [ clipNear, clipFar ];
}
// #endregion

// #region SCREEN PANNING STEPPER
/** Move camera based on view's UP and RIGHT Axis */
export function screenPanStep( camera, xSteps, ySteps, initPos = null ){
    const pos = initPos?.slice() || camera.position.toArray();
    const rot = camera.quaternion.toArray();
  
    // Find the screen's UP and RIGHT Direction
    const rit = vec3.transformQuat( [0, 0, 0], [1, 0, 0], rot );
    const up  = vec3.transformQuat( [0, 0, 0], [0, 1, 0], rot );
  
    // Scale directions & add starting position
    vec3.scaleAndAdd( pos, pos, rit, xSteps );
    vec3.scaleAndAdd( pos, pos, up, ySteps );
  
    return pos;
}

export function screenPanStepInc( camera, xSteps, ySteps ){
    const rot = camera.quaternion.toArray();
  
    // Find the screen's UP and RIGHT Direction
    const rit = vec3.transformQuat( [0, 0, 0], [1, 0, 0], rot );
    const up  = vec3.transformQuat( [0, 0, 0], [0, 1, 0], rot );
  
    // Scale directions & add starting position
    vec3.scale( rit, rit, xSteps );
    vec3.scale( up, up, ySteps );
  
    return [ rit, up ];
}
// #endregion

// #region ARC BALL

// Using screenspace to compute a point on half a sphere. XY are normalized
// based on the size of the screen with the center being origin. Z is 1 at
// the center while it decreases the further away from center the mouse is.
// Z is clamped to minimum of 0.
function screenSphereProjection( pos, size ){
    const res = Math.min( size[0], size[1] ) - 1;
  
    // Invert Y because of how HTML coords works
    const iy = size[1] - pos[1];
  
    // Normalize XY with center as origin. Values will be 0 to Negative/Posititve RES
    const nx = (2 * pos[0] - size[0] - 1) / res;
    const ny = (2 * iy - size[1] - 1) / res;
  
    // At center Z is 1, reaching zero at a radius of 1
    const z = 1.0 - Math.sqrt(nx * nx + ny * ny);
    return [ nx, ny, Math.max(0.0, z) ];
}

/** Using a faux sphere in screen space, determine the arc transform to orbit
 * the camera around a target position. A continuous orientation will
 * be provided for further calls.
 */
function arcBallTransform(
    scrSize,        // Screen size, vec2
    scrPos0,        // Starting mouse position, vec2
    scrPos1,        // Ending Mouse Position, vec2
    rotOrientation, // Current arc orientation, quaternion
    targetPos,      // Position to orbit around
    targetDistance, // Distance from target to be positioned
){
    // Compute the direction of the faux sphere
    const dir0 = screenSphereProjection( scrPos0, scrSize );
    const dir1 = screenSphereProjection( scrPos1, scrSize );
    vec3.normalize(dir0, dir0);
    vec3.normalize(dir1, dir1);
  
    // Create arc rotation from one point of a sphere to another
    // Apply rotation to the initial rotation
    const arcRot = quat.rotationTo( [0,0,0,1], dir1, dir0 );
    quat.mul( arcRot, rotOrientation, arcRot );
    quat.normalize(arcRot, arcRot);
  
    // Compute position from rotOrientation that camera will need to be placed
    const arcPos = vec3.transformQuat( [0,0,0], [0, 0, 1], arcRot );
    vec3.scaleAndAdd( arcPos, targetPos, arcPos, targetDistance );
  
    // Compute look rotation at the target
    // Look directions are inverted for use on a camera
    const upDir = vec3.transformQuat( [0, 0, 0], [0, 1, 0], arcRot );
    const lookDir = vec3.sub( [0, 0, 0], arcPos, targetPos );
    const lookRot = lookDirection( [0, 0, 0], lookDir, upDir );
  
    return { arcPos, arcRot, lookRot };
}

/** Create quaternion from two position that focuses on just X & Y rotation
to remove any possible twisting rotation */
function calcOrientation( camera, targetPosition ) {
    const camPos = camera.position.toArray();
  
    // Get direction and distance to target
    const tarDir   = vec3.sub( [0,0,0], camPos, targetPosition );
    const distance = vec3.len( tarDir );
    vec3.normalize( tarDir, tarDir );
  
    // Flatten direction to XZ Plane
    const tarXZDir = [ tarDir[0], 0.0, tarDir[2] ];
    vec3.normalize( tarXZDir, tarXZDir );
  
    // Create orientation from Y & X rotations
    const rot = quat.rotationTo( [0,0,0,1], [0,0,1], tarXZDir);
    return quat.mul( rot, quat.rotationTo([], tarXZDir, tarDir), rot );
}
// #endregion

// #region SPHERICAL LOOK
/** Use spherical coordinates to set position/rotation of orbit camera */
export function sphericalLook( lon, lat, radius, target = [0, 0, 0] ){
    const pos   = [0, 0, 0];
    const phi   = ((90 - lat) * Math.PI) / 180;
    const theta = ((lon + 180) * Math.PI) / 180;
    const sPhi  = Math.sin( phi );
  
    pos[0] = -( radius * sPhi * Math.sin( theta ));
    pos[1] = radius * Math.cos( phi );
    pos[2] = -( radius * sPhi * Math.cos( theta ) );
    
    const rot = [0,0,0,1];
    if( target ){
        // Rotate camera to look directly at the target
        pos[0]   += target[0];
        pos[1]   += target[1];
        pos[2]   += target[2];
        lookAt( rot, pos, target );
    }
    
    return [ pos, rot ];
}
  
/** Create a rotation from eye & target position */
export function lookAt( out, eye, target = [0, 0, 0], up = [0, 1, 0] ){
    // Forward is inverted, will face correct direction when converted
    // to a ViewMatrix as it'll invert the Forward direction anyway
    const z = vec3.sub( [0, 0, 0], eye, target );
    const x = vec3.cross( [0, 0, 0], up, z );
    const y = vec3.cross( [0, 0, 0], z, x );

    vec3.normalize( x, x );
    vec3.normalize( y, y );
    vec3.normalize( z, z );

    // Format: column-major, when typed out it looks like row-major
    quat.fromMat3( out, [...x, ...y, ...z] );
    return quat.normalize(out, out);
}
// #endregion

// #region ORBIT STEP
export function orbitStep( rx, ry, startPos, targetPos=[0,0,0] ){
    const pos  = vec3.sub( [0,0,0], startPos, targetPos ); // Offset position from target
    const dist = vec3.len( pos );

    // Convert radius to Degrees to use with spherical coordinates
    // Clamp lat so it doesn't roll to the other side
    const polar = cartesian2spherical( pos );
    polar[ 0 ]  = polar[ 0 ] + rx * 57.2957795131;
    polar[ 1 ]  = Math.min( 89.9999, Math.max( -89.9999, polar[1] + ry * 57.2957795131 ) );
    
    spherical2cartesian( polar[0], polar[1], dist, pos );
    vec3.add( pos, pos, targetPos );

    return pos;
}

export function spherical2cartesian( lon, lat, radius=1, out=[0,0,0] ){
    const phi   = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    const sPhi  = Math.sin(phi);

    out[0] = -(radius * sPhi * Math.sin( theta ));
    out[1] = radius * Math.cos( phi );
    out[2] = -(radius * sPhi * Math.cos( theta ));

    return out;
}
  
export function cartesian2spherical( v ){
    const len = Math.sqrt( v[0]**2 + v[2]**2 );
    return [
        Math.atan2( v[0], v[2] ) * (180 / Math.PI), // toDeg
        Math.atan2( v[1], len )  * (180 / Math.PI), // toDeg
    ];
}
// #endregion

// #region ROUND AXIS LOOK ( ALIGN LOOK TO NEAREST WORLD AXIS)
export function roundAxisLook( q ){
    // Get spherical coordinates of the look rotation in radians
    const lookDir = vec3.transformQuat( [0,0,0], [0,0,1], q );
    const coord   = cartesian2sphericalRad( lookDir );

    // Round the angles to the nearest half pi
    const step = Math.PI * 0.5; 
    coord[ 0 ] = Math.round( coord[ 0 ] / step ) * step;
    coord[ 1 ] = Math.round( coord[ 1 ] / step ) * step;

    // Convert coords back to a direction then to a rotation
    const axisDir = spherical2cartesianRad( coord[0], coord[1] );
    return lookDirection( [0,0,0,1], axisDir );
}

export function spherical2cartesianRad( lonRad, latRad, radius=1, out=[0,0,0] ){
    const theta = ( lonRad + Math.PI );
    let   phi   = ( 1.5707963267948966 - latRad ); // PI HALF
          phi   = Math.max( 0.000001, Math.min( Math.PI - 0.000001, phi ) );
    const sPhi  = Math.sin( phi );
    
    out[0] = -(radius * sPhi * Math.sin( theta ));
    out[1] = radius * Math.cos( phi );
    out[2] = -(radius * sPhi * Math.cos( theta ));

    return out;
}
  
export function cartesian2sphericalRad( v ){
    const len = Math.sqrt( v[0]**2 + v[2]**2 );
    return [
        Math.atan2( v[0], v[2] ),
        Math.atan2( v[1], len ), 
    ];
}
// #endregion

// #region MISC
/** Set a position from a distance to a target */
export function zoomTarget( pos, target, distance ){
    const dir = vec3.sub( [0, 0, 0], pos, target );
    vec3.normalize( dir, dir );
    return vec3.scaleAndAdd( dir, target, dir, distance );
}

/** Use euler rotation to orbit around a target */
export function eulerOrbitStep(
    rx,
    ry,
    rz,
    rotOrientation, // Starting arc orientation, quaternion
    targetPos,      // Position to orbit around
    targetDistance, // Distance from target to be positioned.
){
    const orbitRot = quat.fromEuler( [0,0,0,1], rx, ry, rz);
    quat.mul(orbitRot, rotOrientation, orbitRot);
  
    const orbitPos = vec3.transformQuat( [0,0,0], [0,0,1], orbitRot );
    vec3.scaleAndAdd(orbitPos, targetPos, orbitPos, targetDistance);
  
    const upDir   = vec3.transformQuat( [0,0,0], [0,1,0], orbitRot );
    const lookDir = vec3.sub( [0,0,0], orbitPos, targetPos );
    const lookRot = lookDirection( [0,0,0,1], lookDir, upDir );
  
    return { orbitPos, orbitRot, lookRot };
}
// #endregion