import {NextRequest,NextResponse} from 'next/server';

function loopbackPhotoRequest(req:NextRequest){
 const host=req.headers.get('host')||'';
 const origin=req.headers.get('origin');
 return /^(127\.0\.0\.1|localhost):\d+$/.test(host)&&(!origin||origin===`http://${host}`);
}

function hostedPhotoApisEnabled(){
 const flag=(process.env.ATELIER_ALLOW_HOSTED_PHOTO_APIS||'').trim().toLowerCase();
 return flag==='1'||flag==='true'||flag==='yes';
}

/** Loopback preview stays open. Hosted Production needs ATELIER_ALLOW_HOSTED_PHOTO_APIS=1 (not VERCEL_ENV alone). */
export function photoApisAllowed(req:NextRequest){
 return loopbackPhotoRequest(req)||hostedPhotoApisEnabled();
}

export function photoApiForbidden(){
 return NextResponse.json({error:'Local preview only.'},{status:403});
}
