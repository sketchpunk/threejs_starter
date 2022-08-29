// https://developer.mozilla.org/en-US/docs/Web/API/XRHand

export default class XRHand{
    // #region MAIN
    constructor( side='left', inputSource ){
        this.side       = side;
        this.joints     = [];           // Array of joints
        this.mapJoints  = new Map();    // Joints accesssible by their names
        this.jointCount = 0;            // How many joint in the hand, Should always be 25
        this.customData = null;         // Store extra data for dev
        this.onUpdate   = null;         // Callback to call when hand has its input updated

        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        let i=0;
        for( const jName of inputSource.hand.keys() ){
            const j = new XRJoint( i, jName );
            this.joints.push( j );
            this.mapJoints.set( jName, j );
            i++;
        }

        this.jointCount = this.joints.length;
    }

    update( frame, inputSource, refSpace ){
        // TODO: Sometimes the data for a finger can flicker, 
        // Try looking into using springs or some damper to smooth out the data
        // https://theorangeduck.com/page/spring-roll-call
        for( const [ jName, jSpace ] of inputSource.hand ){
            const pose = frame.getJointPose( jSpace, refSpace );
            if( pose ) this.mapJoints.get( jName ).updateFromPose( pose );
        }

        if( this.onUpdate ) this.onUpdate( this );
    }
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