import Link from "next/link";

type Automation = {
  href: string;
  title: string;
  description: string;
};

const automations: Automation[] = [
  {
    href: "/utilization-report",
    title: "Utilization Report",
    description:
      "Generate GradeChum adoption reports for partner schools.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center bg-zinc-50 font-sans min-h-screen">
      <main className="flex w-full max-w-5xl flex-col gap-6 py-16 px-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-black">Automations</h1>
          <p className="text-sm text-zinc-600">
            Customer success automation apps.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {automations.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="rounded-lg border border-zinc-200 bg-white p-5 hover:border-zinc-400 hover:shadow-sm transition"
            >
              <h2 className="text-base font-semibold text-black">{a.title}</h2>
              <p className="mt-1 text-sm text-zinc-600">{a.description}</p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
