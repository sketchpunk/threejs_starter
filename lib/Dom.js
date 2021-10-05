function isStr( s ){ return ( typeof s === "string" ); }
function isElm( s ){ return ( typeof s === "string" )? document.querySelector( s ) : s; }

class Dom{
    static getId( id ){ return document.getElementById( id ); }

    static on( elm, evtName, doStop, fn ){
        elm = isElm( elm );

        if( doStop ){
            elm.addEventListener( evtName, e=>{
                e.stopPropagation();
                e.preventDefault();
                fn( e );
            });
        }else elm.addEventListener( evtName, fn );
        return elm;
    }

    // #region INPUT SELECT
    static addOption( elm, txt, val, optBefore=null ){
        elm = isElm( elm );
        let opt     = document.createElement( "option" );
        opt.text    = txt;
        opt.value   = val;
        elm.add( opt, optBefore );
    }

    static rmOptionByValue( elm, v ){
        elm = isElm( elm );
        const opt = elm.options;

        for( let i=0; i < opt.length; i++ ){
            if( opt[ i ].value == v ){
                elm.remove( i );
                return true;
            }
        }
        return false;
    }

    static rmAllOption( elm ){
        elm = isElm( elm );
        const opt = elm.options;
        for( let i=opt.length-1; i >= 0; i-- ) elm.remove( i );
    }

    static setSelectIndex( elm, idx ){
        elm = isElm( elm );

        switch( idx ){
            case "last" : idx = elm.options.length - 1;
        }

        elm.selectedIndex = idx;
    }

    static getSelectValue( elm ){
        elm = isElm( elm );
        return ( elm.selectedIndex >= 0 )? elm.options[ elm.selectedIndex ].value : null;
    }
    // #endregion //////////////////////////////////////////////////////////////////
}

export default Dom;