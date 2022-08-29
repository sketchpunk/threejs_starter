// https://developer.mozilla.org/en-US/docs/Web/API/XRHand

const WRIST     = "wrist";
const THUMB     = [ "thumb-metacarpal", "thumb-phalanx-proximal", "thumb-phalanx-distal", "thumb-tip" ];
const INDEX     = [ "index-finger-metacarpal", "index-finger-phalanx-proximal", "index-finger-phalanx-intermediate", "index-finger-phalanx-distal", "index-finger-tip" ];
const MIDDLE    = [ "middle-finger-metacarpal", "middle-finger-phalanx-proximal", "middle-finger-phalanx-intermediate", "middle-finger-phalanx-distal", "middle-finger-tip" ];
const RING      = [ "ring-finger-metacarpal", "ring-finger-phalanx-proximal", "ring-finger-phalanx-intermediate", "ring-finger-phalanx-distal", "ring-finger-tip" ];
const PINKY     = [ "pinky-finger-metacarpal", "pinky-finger-phalanx-proximal", "pinky-finger-phalanx-intermediate", "pinky-finger-phalanx-distal", "pinky-finger-tip" ];

function buildChain( hand, list ){
    const ary = [];
    for( let i=1; i < list.length; i++ ){
        ary.push( hand.mapJoints.get( list[ i ] ) );
    }

    return ary;
}

export default class XRHand{
    // #region MAIN
    constructor( side='left', inputSource ){
        this.side       = side;
        this.joints     = [];           // Array of joints
        this.mapJoints  = new Map();    // Joints accesssible by their names
        this.jointCount = 0;            // How many joint in the hand, Should always be 25
        this.customData = null;         // Store extra data for dev
        this.onUpdate   = null;         // Callback to call when hand has its input updated

        // https://developer.mozilla.org/en-US/docs/Web/API/XRInputSource/targetRaySpace
        this.gripPos     = [ 0,0,0 ];
        this.gripRot     = [ 0,0,0,1 ];
        this.gripMat     = [ 1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1 ];

        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        let i=0;
        for( const jName of inputSource.hand.keys() ){
            const j = new XRJoint( i, jName );
            this.joints.push( j );
            this.mapJoints.set( jName, j );
            i++;
        }

        this.jointCount = this.joints.length;

        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        this.wrist     = this.joints[ 0 ];
        this.finThumb  = buildChain( this, THUMB );
        this.finIndex  = buildChain( this, INDEX );
        this.finMiddle = buildChain( this, MIDDLE );
        this.finRing   = buildChain( this, RING );
        this.finPinky  = buildChain( this, PINKY );
    }
    // #endregion

    // #region UPDATING
    update( frame, inputSource, refSpace ){
        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        // TODO: Sometimes the data for a finger can flicker, 
        // Try looking into using springs or some damper to smooth out the data
        // https://theorangeduck.com/page/spring-roll-call
        for( const [ jName, jSpace ] of inputSource.hand ){
            const pose = frame.getJointPose( jSpace, refSpace );
            if( pose ) this.mapJoints.get( jName ).updateFromPose( pose );
        }

        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        const pose = frame.getPose( inputSource.gripSpace, refSpace );
        if( pose?.transform ) this._copyPose( pose, this.gripPos, this.gripRot, this.gripMat );

        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        if( this.onUpdate ) this.onUpdate( this );
    }
    // #endregion

    // #region HELPERS
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

class XRJoint{
    constructor( idx, name ){
        this.idx    = idx;
        this.name   = name;
        this.radius = 0;
        this.pos    = [ 0,0,0 ];
        this.rot    = [ 0,0,0,1 ];
    }
    
    updateFromPose( pose ){
        this.radius   = pose.radius;
        
        this.pos[ 0 ] = pose.transform.position.x;
        this.pos[ 1 ] = pose.transform.position.y;
        this.pos[ 2 ] = pose.transform.position.z;

        this.rot[ 0 ] = pose.transform.orientation.x;
        this.rot[ 1 ] = pose.transform.orientation.y;
        this.rot[ 2 ] = pose.transform.orientation.z;
        this.rot[ 3 ] = pose.transform.orientation.w;
        return this;
    }
}