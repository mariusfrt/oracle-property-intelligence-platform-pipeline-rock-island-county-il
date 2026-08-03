import { AppNav } from "@/components/AppNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <AppNav />
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
