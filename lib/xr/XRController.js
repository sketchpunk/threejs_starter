import * as THREE        from "three";
import PROFILES     from './Profiles.js';
import DynLineMesh  from '../DynLineMesh.js';

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

export default class XRController{
    // #region MAIN
    constructor(){
        // TODO: Make profiles auto detected.
        this.profile     = PROFILES[ 'oculus-touch-v3' ];
        
        this.scene       = null; // Needed To handle Detach

        this.debugLine   = new DynLineMesh( 2 );  // TODO Temp
        this.position    = [0,0,0];
        this.rotation    = [0,0,0,1];
        this.side        = '';

        this.buttonState = {};
        this.attachedObj = null;
        this.raycaster   = new THREE.Raycaster();
        this.tempMatrix  = new THREE.Matrix4();
        this.inputSource = null;

        this.group = new THREE.Group();
        this.mesh  = facedCube( null, 0.05 ); // TODO, Duplicating Geometry isn't a good thing to do.

        //this.line = new THREE.Line( new THREE.BufferGeometry().setFromPoints( [ new THREE.Vector3( 0, 0, 0 ), new THREE.Vector3( 0, 0, - 1 ) ] ) );
        //this.line.scale.z = 0.3;

        //this.group.matrixAutoUpdate = false; // Must disable if manually updating matrix from XR Controller
        this.group.add( this.mesh );
        //this.group.add( this.line );
    }
    // #endregion

    // #region MISC METHODS
    addToScene( parent ){
        console.log( 'Attaching XRCtrl to ', parent?.name );
        parent.add( this.group );
        this.scene.add( this.debugLine ); // TODO Temp
    }

    useMesh( mesh ){
        this.group.add( mesh );
    }
    // #endregion

    // #region UPDATING
    update( frame, inputSource, refSpace ){
        // console.log( this.inputSource === inputSource );
        //this.debugLine.reset()

        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        // Save input source to grab button/axis input
        this.inputSource = inputSource;
        this.updateButtonStates( inputSource );

        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        // Grip Space is the orientation to allow controller models to match up
        // with with how its helt in a hand.

        // const gripPose = frame.getPose( inputSource.gripSpace, refSpace );
        // this.group.matrix.fromArray( gripPose.transform.matrix );

        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        // Ray Space is the orientation to render objects that is pointing
        // forward in relation to the hand. Use it for Raycasting origin / direction
        // or for rendering pointer lines
        const rayPose  = frame.getPose( inputSource.targetRaySpace, refSpace );
        // Need to test, if controller is put out of view this will return nothing
        if( rayPose && rayPose.transform ){
            // TODO : Use Matrix & Transform, avoid ever decomposing a matrix

            // All examples show copying the the matrix...
            // this.group.matrix.fromArray( rayPose.transform.matrix );
            
            // But after digging into the api, learned that we can
            // use Position & Orientation, then dont need to disable
            // matrix auto updating. Using matrix in this context would
            // be better since we save time to generate a new matrix in render loop. 
            this.group.position.copy( rayPose.transform.position );
            this.group.quaternion.copy( rayPose.transform.orientation );

            this.position[0] = rayPose.transform.position.x;
            this.position[1] = rayPose.transform.position.y;
            this.position[2] = rayPose.transform.position.z;

            this.rotation[0] = rayPose.transform.orientation.x;
            this.rotation[1] = rayPose.transform.orientation.y;
            this.rotation[2] = rayPose.transform.orientation.z;
            this.rotation[3] = rayPose.transform.orientation.w;
        }              
    }

    updateButtonStates( inputSource ){
        const gamepad = inputSource?.gamepad;
        const side    = inputSource?.handedness;

        if( gamepad && side ){
            const hand      = this.profile.hands[ side ];
            const states    = this.buttonState;
            let key, idx, btn;
            
            for( key in hand.buttons ){
                idx = hand.buttons[ key ].index;
                btn = gamepad.buttons[ idx ];

                //console.log( "button", key, idx, gamepad.buttons[ idx ] );

                if( states[ key ] === undefined ){
                    states[ key ] = { pressed:false, pressedThisFrame: false };
                }else{
                    if( states[ key ].pressed !== btn.pressed ){
                        states[ key ].pressedThisFrame = true;
                        if( btn.pressed ) console.log( key, 'down', btn );
                        else              console.log( key, 'up', btn );
                    }else{
                        states[ key ].pressedThisFrame = false;
                    }

                    // if( states[ key ].touched !== btn.touched ){
                    //     if( btn.touched ) console.log( key, 'touch down', btn );
                    //     else              console.log( key, 'touch up', btn );
                    // }

                    // if( states[ key ].value !== btn.value ){
                    // }
                }

                states[ key ].pressed = btn.pressed;
                // states[ key ].touched = btn.touched;
                // states[ key ].value   = btn.value;
            }
        }
    }
    // #endregion

    // #region ATTACHING OBJECTS
    attachObject( obj ){
        //console.log( 'Attaching', obj, 'parent', obj.parent );

        if( obj.isGroup ){
            for( const child of obj.children ) child.material.emissive.b = 1;
        }else{
            obj.material.emissive.b = 1;          // Color it to indicate its being held
        }

        obj.userData.isAttached = true;       // Mark it as attached, so the other hand can't grab it.
        obj.userData.prevParent = obj.parent; // Save to detach back to original parent
        this.attachedObj        = obj;        
        this.group.attach( obj );             // Use attach to localize its transform to controllers
    }

    detachObject(){
        if( !this.attachedObj ) return;

        const obj      = this.attachedObj;
        const userData = this.attachedObj.userData;
        //console.log( 'Detaching', this.attachedObj, 'parent', this.attachedObj.userData.prevParent );

        if( userData.prevParent ){
            userData.prevParent.attach( this.attachedObj );
        }else{
            this.scene.attach( this.attachedObj );
        }

        if( obj.isGroup ){
            for( const child of obj.children ) child.material.emissive.b = 0;
        }else{
            obj.material.emissive.b = 0;
        }

        userData.prevParent                     = null;
        userData.isAttached                     = false;
        this.attachedObj                        = null;
    }
    // #endregion

    // #region RAY CASTING
    getRayCaster(){
        // //this.group.updateWorldMatrix(); // might be needed
        // this.tempMatrix.identity().extractRotation( this.group.matrix );                // Get controllers WS Rotation
        // this.raycaster.ray.origin.setFromMatrixPosition( this.group.matrix );           // Set controller's WS Position as origin
        // this.raycaster.ray.direction.set( 0, 0, -1 ).applyMatrix4( this.tempMatrix );   // Apply WS Rotation to Forward Vector

        // If not using Matrix Updating, then group already hold the information we need without the need to decompose a matrix.
        //this.raycaster.ray.origin.copy( this.group.position );                                  // Set controller's WS Position as origin
        //this.raycaster.ray.direction.set( 0, 0, -1 ).applyQuaternion( this.group.quaternion );  // Apply WS Rotation to Forward Vector
        

        // If the Controllers are parented to a moving floor, need to compute world space Position & Rotation 
        // of the controller to get the proper origin and direction for doing a ray cast.
        const pos = new THREE.Vector3();
        const rot = new THREE.Quaternion();
        this.group.getWorldPosition( pos );
        this.group.getWorldQuaternion( rot );

        this.raycaster.ray.origin.copy( pos );                                // Set controller's WS Position as origin
        this.raycaster.ray.direction.set( 0, 0, -1 ).applyQuaternion( rot );  // Apply WS Rotation to Forward Vector

        const endPos = [
            pos.x + this.raycaster.ray.direction.x * 200,
            pos.y + this.raycaster.ray.direction.y * 200,
            pos.z + this.raycaster.ray.direction.z * 200,
        ];

        this.debugLine
            .reset()
            .add(
                this.raycaster.ray.origin.toArray(),
                endPos,
                0xff0000,
            )
            ._updateGeometry()
        ;

        return this.raycaster;
    }
    // #endregion

    // #region GET CONTROLLER INPUT
    getAxes( out=null ){
        const gamepad = this.inputSource?.gamepad;
        const side    = this.inputSource?.handedness;
        out           = out || [ 0,0 ];

        // NOTES: Need to test for gamepad.axis because simulator doesn't provide that info.
        if( side && gamepad && gamepad.axes && this.profile ){
            const axes = this.profile.hands[ side ].axes;
            out[ 0 ]   = gamepad.axes[ axes.x.index ] * axes.x.sign;
            out[ 1 ]   = gamepad.axes[ axes.y.index ] * axes.y.sign;
        }

        return out;
    }

    _getButtonIndex( btnName ){
        const side = this.inputSource?.handedness;
        return ( side && this.profile )?
            this.profile.hands[ side ].buttons[ btnName ].index :
            null;
    }

    // Is the button pressed down
    isButtonPressed( btnName ){
        const gamepad = this.inputSource?.gamepad;
        if( gamepad && this.profile ){
            const btnIdx = this._getButtonIndex( btnName );
            if( btnIdx != null ) return gamepad.buttons[ btnIdx ].pressed;
        }
        return false;
    }

    isButtonUpThisFrame( btnName ){
        const state = this.buttonState[ btnName ];
        return( state && state.pressedThisFrame && !state.pressed );
    }

    isButtonDownThisFrame( btnName ){
        const state = this.buttonState[ btnName ];
        return( state && state.pressedThisFrame && state.pressed );
    }

    // Is the button being touched but not pressed
    isButtonTouched( btnName ){
        const gamepad = this.inputSource?.gamepad;
        if( gamepad && this.profile ){
            const btnIdx = this._getButtonIndex( btnName );
            if( btnIdx != null ) return gamepad.buttons[ btnIdx ].touched;
        }
        return false;
    }

    // Get Button value, for trigger & grip value between 0 & 1
    getButtonValue( btnName ){
        const gamepad = this.inputSource?.gamepad;
        if( gamepad && this.profile ){
            const btnIdx = this._getButtonIndex( btnName );
            if( btnIdx != null ) return gamepad.buttons[ btnIdx ].value;
        }
        return 0;
    }
    // #endregion
}