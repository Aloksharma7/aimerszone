export default function Loading() {
  return (
    <div className="min-h-[70vh] bg-canvas px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px] animate-pulse">
        <div className="h-4 w-32 rounded bg-slate-200"/>
        <div className="mt-3 h-9 w-80 max-w-full rounded bg-slate-200"/>
        <div className="mt-3 h-4 w-[520px] max-w-full rounded bg-slate-200"/>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({length:4}).map((_,index)=><div key={index} className="h-32 rounded-2xl border border-slate-200 bg-white"/>)}</div>
        <div className="mt-6 h-[420px] rounded-2xl border border-slate-200 bg-white"/>
      </div>
    </div>
  );
}
