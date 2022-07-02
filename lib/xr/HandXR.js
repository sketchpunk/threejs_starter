import { quat, vec3 } from "gl-matrix";
import * as THREE       from "three";
import DynLineMesh      from '../meshes/DynLineMesh.js';
import ShapePointsMesh  from '../meshes/ShapePointsMesh.js';

// TODO : Temporary use faceCube for controller models
// Cube where each face is a different color. Can be used to also help
// with orientation by looking at the faces : FORWARD: Red, RIGHT: Green, UP: Blue
function facedCube( pos=null, scl=null ){
    const geo = new THREE.BoxGeometry( 1, 1, 1 );
    const mat = [
        new THREE.MeshBasicMaterial( { color: 0x00ff00 } ), // Right
        new THREE.MeshBasicMaterial( { color: 0x777777 } ), // Left
        new THREE.MeshBasicMaterial( { color: 0x0000ff } ), // Top
        new THREE.MeshBasicMaterial( { color: 0x222222 } ), // Bottom
        new THREE.MeshBasicMaterial( { color: 0xff0000 } ), // Forward
        new THREE.MeshBasicMaterial( { color: 0xffffff } ), // Back
    ];

    const mesh = new THREE.Mesh( geo, mat );
    
    if( pos )			mesh.position.fromArray( pos );
    if( scl != null )	mesh.scale.set( scl, scl, scl );

    return mesh; 
}

const WRIST     = "wrist";
const THUMB     = [ "thumb-metacarpal", "thumb-phalanx-proximal", "thumb-phalanx-distal", "thumb-tip" ];
const INDEX     = [ "index-finger-metacarpal", "index-finger-phalanx-proximal", "index-finger-phalanx-intermediate", "index-finger-phalanx-distal", "index-finger-tip" ];
const MIDDLE    = [ "middle-finger-metacarpal", "middle-finger-phalanx-proximal", "middle-finger-phalanx-intermediate", "middle-finger-phalanx-distal", "middle-finger-tip" ];
const RING      = [ "ring-finger-metacarpal", "ring-finger-phalanx-proximal", "ring-finger-phalanx-intermediate", "ring-finger-phalanx-distal", "ring-finger-tip" ];
const PINKY     = [ "pinky-finger-metacarpal", "pinky-finger-phalanx-proximal", "pinky-finger-phalanx-intermediate", "pinky-finger-phalanx-distal", "pinky-finger-tip" ];


class Joint{
    constructor( idx, name ){
        this.idx      = idx;
        this.name     = name;
        this.position = [0,0,0];
        this.rotation = [0,0,0,1];
        this.radius   = 0;
    }

    setPos( x, y, z ){
        if( arguments.length == 3 ){
            this.position[0] = x;
            this.position[1] = y;
            this.position[2] = z;
        }else if( 'x' in x ){
            this.position[0] = x.x;
            this.position[1] = x.y;
            this.position[2] = x.z;
        }else if( x.length == 3 ){
            this.position[0] = x[0];
            this.position[1] = x[1];
            this.position[2] = x[2];
        }else{
            console.warn( 'can not set joint position', x ,y, z );
        }
        
        return this;
    }

    setRot( x, y, z, w ){
        if( arguments.length == 4 ){
            this.rotation[0] = x;
            this.rotation[1] = y;
            this.rotation[2] = z;
            this.rotation[3] = w;
        }else if( 'x' in x ){
            this.rotation[0] = x.x;
            this.rotation[1] = x.y;
            this.rotation[2] = x.z;
            this.rotation[3] = x.w;
        }else if( x.length == 3 ){
            this.rotation[0] = x[0];
            this.rotation[1] = x[1];
            this.rotation[2] = x[2];
            this.rotation[3] = x[3];
        }else{
            console.warn( 'can not set joint rotation', x ,y, z, w );
        }
        
        return this;
    }

    fromPose( pose ){
        this.radius = pose.radius;

        // const dist = 
        //     (pose.transform.orientation.x - this.rotation[0]) ** 2 +
        //     (pose.transform.orientation.y - this.rotation[1]) ** 2 +
        //     (pose.transform.orientation.z - this.rotation[2]) ** 2 +
        //     (pose.transform.orientation.w - this.rotation[3]) ** 2;

        // if( dist > 0.0001 ){
            this.setPos( pose.transform.position );
            this.setRot( pose.transform.orientation );
        // }

        return this;
    }
}

export default class HandXR{
    // #region MAIN
    constructor(){
        this.inputSource = null;
        this.joints      = [];
        this.mapName     = new Map();
        this.group       = new THREE.Group();
        this.pnt         = new ShapePointsMesh( 25 );
        this.side        = '';

        this.position    = [0,0,0];
        this.rotation    = [0,0,0,1];

        //this.mesh  = facedCube( null, 0.05 ); // TODO, Duplicating Geometry isn't a good thing to do.
        this.meshes = [];

        this.handMesh  = null;

        this.finThumb  = [];
        this.finIndex  = [];
        this.finMiddle = [];
        this.finRing   = [];
        this.finPinky  = [];

        //this.line = new THREE.Line( new THREE.BufferGeometry().setFromPoints( [ new THREE.Vector3( 0, 0, 0 ), new THREE.Vector3( 0, 0, - 1 ) ] ) );
        //this.line.scale.z = 0.3;

        //this.group.matrixAutoUpdate = false; // Must disable if manually updating matrix from XR Controller
        //this.group.add( this.pnt );
        //this.group.add( this.mesh );
        //this.group.add( this.line );
    }
    // #endregion

    // #region MISC METHODS
    addToScene( parent ){
        console.log( 'Attaching Hand to ', parent?.name );
        parent.add( this.group );
    }

    // useMesh( mesh ){
    //     this.group.add( mesh );
    // }
    // #endregion

    setHandMesh( hand ){
        this.group.add( hand.root );
        this.handMesh = hand;
    }

    // #region UPDATING
    update( frame, inputSource, refSpace ){
        // console.log( this.inputSource === inputSource );
        //this.debugLine.reset()

        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        // Save input source to grab button/axis input
        this.inputSource = inputSource;
        
        if( inputSource.hand ){
            if( this.joints.length == 0 ) this._loadJoints( inputSource );
            this._updateJoints( inputSource, frame, refSpace );
            
            // this.pnt.reset();
            // for( let j of this.joints ){
            //     this.pnt.add( j.position, 0xa0a0a0, 0.5 );
            // }

            // this.pnt._updateGeometry();

            // Get Wrist Joint, use its rotation & position on mesh
            if( this.handMesh ){
                // const wrist = this.getJointByName( 'wrist' );
                // this.handMesh.updateRoot( wrist.position, wrist.rotation );
                this.handMesh.update( this );
                // console.log( wrist );
                // this.handMesh.position.fromArray( wrist.position );
                // this.handMesh.quaternion.fromArray( wrist.rotation );
            }
        }

        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        // Grip Space is the orientation to allow controller models to match up
        // with with how its helt in a hand.

        // const gripPose = frame.getPose( inputSource.gripSpace, refSpace );
        // this.group.matrix.fromArray( gripPose.transform.matrix );

        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        // Ray Space is the orientation to render objects that is pointing
        // forward in relation to the hand. Use it for Raycasting origin / direction
        // or for rendering pointer lines
        const rayPose  = frame.getPose( inputSource.targetRaySpace, refSpace ); //targetRaySpace
        // Need to test, if controller is put out of view this will return nothing
        if( rayPose && rayPose.transform ){
            // TODO : Use Matrix & Transform, avoid ever decomposing a matrix

            // All examples show copying the the matrix...
            // this.group.matrix.fromArray( rayPose.transform.matrix );
            
            // But after digging into the api, learned that we can
            // use Position & Orientation, then dont need to disable
            // matrix auto updating. Using matrix in this context would
            // be better since we save time to generate a new matrix in render loop. 
            //this.group.position.copy( rayPose.transform.position );
            //this.group.quaternion.copy( rayPose.transform.orientation );

            this.position[0] = rayPose.transform.position.x;
            this.position[1] = rayPose.transform.position.y;
            this.position[2] = rayPose.transform.position.z;

            this.rotation[0] = rayPose.transform.orientation.x;
            this.rotation[1] = rayPose.transform.orientation.y;
            this.rotation[2] = rayPose.transform.orientation.z;
            this.rotation[3] = rayPose.transform.orientation.w;
        }              
    }

    _loadJoints( inputSource ){
        let i=0;
        for( let [joint, jointSpace] of inputSource.hand ){
            this.joints.push( new Joint( i, joint ) );
            this.mapName.set( joint, i );
            i++;

            const m = new THREE.AxesHelper( 0.03 );
            this.group.add( m );
            this.meshes.push( m );
        }

        this._buildChain( this.finThumb, THUMB );
        this._buildChain( this.finIndex, INDEX );
        this._buildChain( this.finMiddle, MIDDLE );
        this._buildChain( this.finRing, RING );
        this._buildChain( this.finPinky, PINKY );
    }

    getJointByName( name ){
        return this.joints[ this.mapName.get( name ) ];
    }

    _buildChain( ary, list ){
        for( let i=1; i < list.length; i++ ){
            ary.push( this.getJointByName( list[ i ] ) );
        }
    }

    _updateJoints( src, frame, refSpace ){
        let pose, i = 0;
        let dist = 0;

        for( let jointSpace of src.hand.values() ){
            pose = frame.getJointPose( jointSpace, refSpace );

            if( pose != null ){
                //console.log( i, pose, pose?.transform )
                this.joints[ i ].fromPose( pose );

                // this.meshes[ i ].position.copy( pose.transform.position );
                // this.meshes[ i ].quaternion.copy( pose.transform.orientation );
            }
            i++;
        }        
    }
    
    // #endregion
}