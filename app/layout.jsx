import "./globals.css";

export const metadata = {
  title: "InfraLens",
  description: "Audit, compare, and review exported infrastructure data with topology context and change tracking.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
