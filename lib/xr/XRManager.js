import * as THREE        from "three";
import XRController from './XRController.js';
import HandXR from './HandXR.js';

export default class XRManager{
    // #region MAIN
    isActive        = false;
    renderer        = null;
    scene           = null;
    camera          = null;
    xrCamera        = null;
    roomSpace       = null;
    ctrlMap         = new Map();
    ctrlMesh        = null;

    worldPosition    = new THREE.Vector3();
    forwardDirection = new THREE.Vector3(); // TODO : Should use gl-matrix or any proper math library for 3D development
    rightDirection   = new THREE.Vector3();
    upDirection      = new THREE.Vector3();

    bindSelect       = this._onSelect.bind( this );
    bindSelectStart  = this._onSelectStart.bind( this );
    bindSelectEnd    = this._onSelectEnd.bind( this );
    bindSqueeze      = this._onSqueeze.bind( this );
    bindSqueezeStart = this._onSqueezeStart.bind( this );
    bindSqueezeEnd   = this._onSqueezeEnd.bind( this );

    onTriggerDown    = null;
    onTriggerUp      = null;
    onXRStart        = null;
    onLoadHand       = null;
    onLoadController = null;

    constructor(){}

    init(renderer, scene){
        this.renderer       = renderer;
        this.scene          = scene;
    }
    // #endregion

    // #region GETTERS
    getController( key ){ return this.ctrlMap.get( key ); }
    // #endregion

    // #region UPDATING
    update( frame ){
        // Test when XR turns On/Off
        if( this.renderer.xr.isPresenting && !this.isActive )       this._onXRStart( frame );
        else  if( !this.renderer.xr.isPresenting && this.isActive ) this._onXREnd();

        if( !this.isActive ) return false;

        const referenceSpace = this.renderer.xr.getReferenceSpace();

        // session.requestReferenceSpace('local').then((refSpace) => {
        //     xrRefSpace = refSpace.getOffsetReferenceSpace(new XRRigidTransform({x: 0, y: 1.5, z: 0}));
        // });

        if( this.ctrlMap.size === 0 ) this._setupControllers( frame, referenceSpace );
        
        let key;
        for( const src of frame.session.inputSources ){
            if( !src.handedness ) continue;

            key = ( !src.hand )? src.handedness : src.handedness + '_hand';

            const ctrl = this.ctrlMap.get( key );
            if( ctrl ) ctrl.update( frame, src, referenceSpace );
        }

        // Get headset information
        //const viewPose = frame.getViewerPose( referenceSpace );
        //console.log( viewPose.transform.position, viewPose.transform.orientation );
        return true;
    }

    updatesFromCamera(){
        this.xrCamera = this.renderer.xr.getCamera( this.camera );
        this.xrCamera.updateWorldMatrix( true, false );

        const elm = this.xrCamera.matrixWorld.elements;
        this.rightDirection.set( elm[0], elm[1], elm[2] ).normalize();
        this.upDirection.set( elm[4], elm[5], elm[6] ).normalize();
        this.forwardDirection.set( -elm[8], -elm[9], -elm[10] ).normalize();
        this.worldPosition.set( elm[12], elm[13], elm[14] );
    }
    // #endregion

    // #region SETUP
    _setupControllers( frame, referenceSpace ){
        const session = this.renderer.xr.getSession();
        for( const src of session.inputSources ){
            if( src.handedness ){
                if( src.hand ){
                    console.log( 'Loading Hand : ', src.handedness + '_hand', src.hand );
                    const ctrl = new HandXR();
                    ctrl.side = src.handedness;

                    ctrl.addToScene( this.roomSpace || this.scene );
                    this.ctrlMap.set( src.handedness + '_hand', ctrl );

                    if( this.onLoadHand ) this.onLoadHand( ctrl );
                }else{
                    console.log( 'Loading Controller: ', src.handedness, "isHand", src.hand );
                    const ctrl = new XRController();
                    ctrl.side = src.handedness;
                    ctrl.updateButtonStates( src );
                    ctrl.scene = this.scene;
                    ctrl.addToScene( this.roomSpace || this.scene );
                    this.ctrlMap.set( src.handedness, ctrl );

                    if( this.onLoadController ) this.onLoadController( ctrl );

                    // const scl = 0.15;
                    // const mesh = this.ctrlMesh.clone();
                    // mesh.rotation.x = -Math.PI * 0.5;
                    // mesh.scale.set( scl, scl, scl );
                    // ctrl.useMesh( mesh );
                }
            }
        }
    }
    // #endregion

    // #region MAIN EVENTS
    _onXRStart( frame ){
        console.log( 'XR Start' );
        this.isActive = true;
        
        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        // SETUP EVENTS LISTENERS
        const session = this.renderer.xr.getSession();
        // session.addEventListener( 'end', onSessionEnd );
        session.addEventListener( 'select', this.bindSelect );
        session.addEventListener( 'selectstart', this.bindSelectStart );
        session.addEventListener( 'selectend', this.bindSelectEnd );
        session.addEventListener( 'squeeze', this.bindSqueeze );
        session.addEventListener( 'squeezestart', this.bindSqueezeStart );
        session.addEventListener( 'squeezeend', this.bindSqueezeEnd );
        session.addEventListener( 'inputsourceschange', e=>{
            console.log( 'inputsourceschange', e ); 
        });

        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        if( this.onXRStart ) this.onXRStart( session, frame );
    }

    _onXREnd(){
        console.log( 'XR End' );
        this.isActive = false;

        const session = this.renderer.xr.getSession();
        session.removeEventListener( 'select', this.bindSelect );
        session.removeEventListener( 'selectstart', this.bindSelectStart );
        session.removeEventListener( 'selectend', this.bindSelectEnd );
        session.removeEventListener( 'squeeze', this.bindSqueeze );
        session.removeEventListener( 'squeezestart', this.bindSqueezeStart );
        session.removeEventListener( 'squeezeend', this.bindSqueezeEnd );
    }
    // #endregion

    // #region SESSION - CONTROLLER EVENTS
    _onSelect( e ){ 
        //console.log( 'select', e.type, e.inputSource );
    }

    _onSelectStart( e ){ 
        // console.log( 'selectstart', e.type, e.inputSource.handedness );
        // if( this.onTriggerDown ){
        //     const ctrl = this.ctrlMap.get( e.inputSource.handedness );
        //     this.onTriggerDown( ctrl );
        // }
    }

    _onSelectEnd( e ){
        // console.log( 'selectend', e );
        // if( this.onTriggerUp ){
        //     const ctrl = this.ctrlMap.get( e.inputSource.handedness );
        //     this.onTriggerUp( ctrl );
        // }
    }

    _onSqueeze( e ){ 
        // console.log( '_onSqueeze', e );
    }
    
    _onSqueezeStart( e ){
        // console.log( '_onSqueezeStart', e );
        // const ctrl = this.ctrlMap.get( e.inputSource.handedness );
        // const ray  = ctrl.getRayCaster();
        // const hits = ray.intersectObjects( this.groupRaycast.children, true );

        // if( hits.length > 0 ){
        //     ctrl.attachObject( hits[0].object );
        // }
    }
    
    _onSqueezeEnd( e ){
        // console.log( '_onSqueezeEnd', e );
        // this.ctrlMap.get( e.inputSource.handedness ).detachObject();
    }
    // #endregion
}

