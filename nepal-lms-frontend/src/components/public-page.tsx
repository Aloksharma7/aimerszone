import { Panel } from "@/components/ui";

export function PublicPageHero({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <section className="border-b border-slate-200 bg-canvas py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-brand-700">{eyebrow}</p>
          <h1 className="mt-3 text-balance text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">{title}</h1>
          <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">{description}</p>
        </div>
      </div>
    </section>
  );
}

export function PolicyPage({ title, intro, sections }: { title: string; intro: string; sections: { heading: string; body: string }[] }) {
  return (
    <>
      <PublicPageHero eyebrow="Policy" title={title} description={intro} />
      <section className="bg-white py-12 sm:py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <Panel>
            <div className="space-y-8">
              {sections.map((section) => <section key={section.heading}><h2 className="text-xl font-bold text-slate-950">{section.heading}</h2><p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-600">{section.body}</p></section>)}
            </div>
          </Panel>
        </div>
      </section>
    </>
  );
}
