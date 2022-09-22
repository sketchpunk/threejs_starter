import { vec3 } from 'gl-matrix';
import { Group, Quaternion, Vector3, Raycaster } from 'three';
import { quat_mul, vec3_add, vec3_transformQuat } from './XRController';

export default class XRRoom extends Group{
    worldPosition   = [0,0,0];
    worldRotation   = [0,0,0,1];
    worldScale      = [1,1,1];

    setPos( p ){ this.position.fromArray( p ); return this; }

    updateWorldTransform(){
        const v = new Vector3();
        const q = new Quaternion();
        this.worldScale    = this.getWorldScale( v ).toArray();
        this.worldPosition = this.getWorldPosition( v ).toArray();
        this.worldRotation = this.getWorldQuaternion( q ).toArray();
        return this;
    }

    getControllerRayCaster( ctrl, ray=new Raycaster() ){
        const wrot = quat_mul( [0,0,0,1], this.worldRotation, ctrl.rayRot ); // worldRot = parent.rot * child.rot();
        const wdir = vec3_transformQuat( [0,0,0], [0,0,-1], wrot );          // -Z forward direction of ray

        const wpos = [0,0,0];
        vec3_transformQuat( wpos, ctrl.rayPos, this.worldRotation );         // worldPos = parent.pos + ( parent.rot * ( child.pos * parent.scale ) )
        vec3_add( wpos, this.worldPosition, wpos );

        ray.set( 
            new Vector3( wpos[0], wpos[1], wpos[2] ), 
            new Vector3( wdir[0], wdir[1], wdir[2] ), 
        );

        return ray;
    }
}