import Link from "next/link";

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        background: "#f7f7f7",
        padding: 24,
      }}
    >
      <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 16 }}>
        Bienvenido a Yuyu Family
      </h1>
      <p style={{ fontSize: 18, marginBottom: 32 }}>
        Este es nuestro árbol genealógico.
      </p>
      <Link
        href="/familia/arbol"
        style={{
          padding: "12px 32px",
          background: "#222",
          color: "#fff",
          borderRadius: 8,
          textDecoration: "none",
          fontWeight: 600,
          fontSize: 18,
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          transition: "background 0.2s",
        }}
      >
        Ver el árbol
      </Link>
    </main>
  );
}