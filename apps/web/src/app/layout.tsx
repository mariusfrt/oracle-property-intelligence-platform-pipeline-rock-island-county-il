import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rock Island County Property Intelligence",
  description: "Oracle property intelligence — DuckDB over Parquet, no hosted DB",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header style={{ padding: "12px 20px", borderBottom: "1px solid #e5e7eb" }}>
          <nav style={{ display: "flex", gap: 16 }}>
            <a href="/">Run Summary</a>
            <a href="/explorer">Explorer</a>
            <a href="/data-center">Data-center candidates</a>
          </nav>
        </header>
        <main style={{ padding: 20 }}>{children}</main>
      </body>
    </html>
  );
}
