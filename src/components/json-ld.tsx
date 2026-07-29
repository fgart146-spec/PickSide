// Renders a structured-data <script> tag. `data` is our own JSON-LD object
// (never raw user input), so JSON.stringify is a safe serialization here —
// no HTML/script injection surface.
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
