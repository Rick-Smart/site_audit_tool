import "./globals.css";

export const metadata = {
  title: "Network Site Audit Tool",
  description: "Upload CSV exports and topology PNGs to generate a site audit readout PDF.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
