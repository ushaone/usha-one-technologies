// Promise-level deadline also bounds providers that ignore AbortSignal.
export function deadline(timeoutMs, message='Operation deadline exceeded') {
  const controller=new AbortController();
  let timer;
  const expired=new Promise((_,reject)=>{
    timer=setTimeout(()=>{controller.abort();reject(Error(message))},timeoutMs);
  });
  return {signal:controller.signal,wait:operation=>Promise.race([operation,expired]),clear:()=>clearTimeout(timer)};
}
