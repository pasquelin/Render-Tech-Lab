/** Encode an explorer RGBA buffer (bottom-left origin) to a JPEG data URL for the report. */
export function jpegFromRgba(pixels:Uint8Array,width:number,height:number,maxWidth=640){
 if(pixels.length!==width*height*4)throw new Error('RGBA size does not match the canvas.');
 const scale=Math.min(1,maxWidth/width);
 const outWidth=Math.max(1,Math.round(width*scale)),outHeight=Math.max(1,Math.round(height*scale));
 const full=document.createElement('canvas');full.width=width;full.height=height;
 const fullContext=full.getContext('2d');if(!fullContext)throw new Error('Canvas 2D unavailable for capture.');
 const image=fullContext.createImageData(width,height);
 const row=width*4;
 for(let y=0;y<height;y++)image.data.set(pixels.subarray((height-1-y)*row,(height-y)*row),y*row);
 fullContext.putImageData(image,0,0);
 if(outWidth===width&&outHeight===height)return full.toDataURL('image/jpeg',.8);
 const scaled=document.createElement('canvas');scaled.width=outWidth;scaled.height=outHeight;
 const scaledContext=scaled.getContext('2d');if(!scaledContext)throw new Error('Canvas 2D unavailable for capture.');
 scaledContext.drawImage(full,0,0,outWidth,outHeight);
 return scaled.toDataURL('image/jpeg',.8);
}
