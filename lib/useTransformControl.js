import { AxesHelper, Group } from 'three';
import { TransformControls } from 'threejsm/controls/TransformControls.js';

export default function useTransformControl( tjs ){
    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    const gizmo = new TransformControls( tjs.camera, tjs.renderer.domElement );
    gizmo.setSpace( 'local' );
    tjs.scene.add( gizmo );

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    const self  = {
        o        : gizmo,
        onRotate : null,
        onMove   : null,
        onStart  : null,
        onStop   : null,

        attach      : o=>{ gizmo.attach( o ); return self; },
        detach      : ()=>{
            gizmo.detach();
            if( self.axes ) self.axes.visible = false;
            return self;
        },

        toTranslate : ()=>{ gizmo.setMode( 'translate' ); return self; },
        toRotate    : ()=>{ gizmo.setMode( 'rotate' ); return self; },

        useWorld    : ()=>{ gizmo.setSpace( 'world' ); return self; },
        useLocal    : ()=>{ gizmo.setSpace( 'local' ); return self; },

        setPos      : p=>{
            if( gizmo.object ) gizmo.object.position.fromArray( p );
            return self;
        },

        useSolo     : ()=>{ gizmo.attach( (self.solo = new Group()) ); tjs.scene.add( self.solo ); return self; },
        useAxes     : ( s=0.5 )=>{
            if( !self.axes ){
                self.axes = new AxesHelper();
                self.axes.scale.setScalar( s );
                tjs.scene.add( self.axes );
            }

            self.axes.visible = true;
            gizmo.attach( self.axes );
            return self;
        },
    };

    const onDragChange = e=>{
        if( tjs.camCtrl ) tjs.camCtrl.enabled = !e.value;

        if( e.value && self.onStart )      self.onStart();
        else if( !e.value && self.onStop ) self.onStop();
    };

    const onChange = ()=>{
        const o = gizmo.object;
        if(! (o && gizmo.dragging) ) return;
        
        switch( gizmo.mode ){
            case 'translate':
                if( self.onMove )   self.onMove( o.position.toArray() );
                break;

            case 'rotate':
                if( self.onRotate ) self.onRotate( o.quaternion.toArray() );
                break;
        }
    };

    gizmo.addEventListener( 'dragging-changed', onDragChange );
    gizmo.addEventListener( 'change', onChange );

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    return self;
}