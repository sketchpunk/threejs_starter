import Stats                    from 'three/examples/jsm/libs/stats.module.js';

export default function useStats( App, toRight=false ){
    const stats = new Stats();
    stats.showPanel( 0 );
    
    if( toRight ) stats.dom.style.cssText = 'position:fixed;top:0;right:0;cursor:pointer;opacity:0.9;z-index:10000';

    document.body.appendChild( stats.dom );
    App.onRenderPost = ( dt, et )=>stats.update();
}