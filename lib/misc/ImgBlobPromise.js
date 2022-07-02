export function ImgBlobPromise( blob ){
    let img 		= new Image();
    img.crossOrigin	= "anonymous";
    img.src 		= window.URL.createObjectURL( blob );
    return new Promise( ( resolve, reject )=>{
        img.onload	= _ => resolve( img );
        img.onerror	= reject;
    });
}