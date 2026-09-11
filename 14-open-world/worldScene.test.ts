import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { districtIntersectsViews, validateWorldOptions } from './worldScene.ts';
const boxFrustum=(x:number)=>new THREE.Frustum(
  new THREE.Plane(new THREE.Vector3(1,0,0),1-x),new THREE.Plane(new THREE.Vector3(-1,0,0),1+x),
  new THREE.Plane(new THREE.Vector3(0,1,0),1),new THREE.Plane(new THREE.Vector3(0,-1,0),1),
  new THREE.Plane(new THREE.Vector3(0,0,1),1),new THREE.Plane(new THREE.Vector3(0,0,-1),1));
const camera=boxFrustum(0),shadow=boxFrustum(10);
test('district union retains tangency, shadow-only casters and unknown bounds',()=>{
  assert.equal(districtIntersectsViews(new THREE.Sphere(new THREE.Vector3(0,0,0),.2),camera,[]),true);
  assert.equal(districtIntersectsViews(new THREE.Sphere(new THREE.Vector3(2,0,0),1),camera,[]),true);
  assert.equal(districtIntersectsViews(new THREE.Sphere(new THREE.Vector3(10,0,0),.2),camera,[shadow]),true);
  assert.equal(districtIntersectsViews(new THREE.Sphere(new THREE.Vector3(20,0,0),.2),camera,[shadow]),false);
  assert.equal(districtIntersectsViews(new THREE.Sphere(new THREE.Vector3(20,0,0),NaN),camera,[]),true);
  assert.equal(districtIntersectsViews(new THREE.Sphere(new THREE.Vector3(NaN,0,0),1),camera,[]),true);
});
test('130000 enclosed points: no district containing a visible point is rejected',()=>{
  let visiblePoints=0,checked=0;
  for(let i=0;i<10000;i++){
    const center=new THREE.Vector3(Math.sin(i*.9)*20,Math.cos(i*.23)*4,Math.sin(i*.41)*4),radius=.1+(i%31)/10;
    const keep=districtIntersectsViews(new THREE.Sphere(center,radius),camera,[shadow]);
    const offsets=[new THREE.Vector3(),...Array.from({length:12},(_,j)=>new THREE.Vector3(Math.sin(j*1.4),Math.cos(j*.9),Math.sin(j*.43)).normalize().multiplyScalar(radius))];
    for(const offset of offsets){const point=center.clone().add(offset);checked++;
      if(camera.containsPoint(point)||shadow.containsPoint(point)){assert.equal(keep,true);visiblePoints++;}
    }
  }
  assert.equal(checked,130000);assert.ok(visiblePoints>0);
});

test('optional display settings preserve defaults and reject unsupported domains',()=>{
  const base={width:1920,height:1080,pixelRatio:2,districts:9 as const,samples:60,warmup:30,shadows:true,candidate:'frustum' as const};
  assert.doesNotThrow(()=>validateWorldOptions(base));
  assert.doesNotThrow(()=>validateWorldOptions({...base,fov:10,antialias:true,shadowMapSize:4096,path:'panorama'}));
  assert.doesNotThrow(()=>validateWorldOptions({...base,fov:120,path:'perimeter',wireframe:true,showBounds:false,previewDurationSeconds:60}));
  for(const previewDurationSeconds of [NaN,Infinity,9,181])assert.throws(()=>validateWorldOptions({...base,previewDurationSeconds}));
  assert.throws(()=>validateWorldOptions({...base,wireframe:1 as unknown as boolean}));
  assert.throws(()=>validateWorldOptions({...base,showBounds:'yes' as unknown as boolean}));
  for(const fov of [NaN,Infinity,9,121])assert.throws(()=>validateWorldOptions({...base,fov}));
  assert.throws(()=>validateWorldOptions({...base,shadowMapSize:512 as 1024}));
  assert.throws(()=>validateWorldOptions({...base,path:'unknown' as 'mixed'}));
});
