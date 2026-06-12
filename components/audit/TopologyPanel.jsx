import Image from "next/image";
import Panel from "../ui/Panel";

export default function TopologyPanel({ topologies }) {
  if (topologies.length === 0) {
    return null;
  }

  return (
    <Panel title="Topology Preview" count={topologies.length} revealClass="reveal delayed-4">
      <div className="topology-grid">
        {topologies.map((image) => (
          <figure key={image.name} className="topology-card">
            <Image
              src={image.dataUrl}
              alt={image.name}
              width={1000}
              height={700}
              unoptimized
              className="topology-image"
            />
            <figcaption>{image.name}</figcaption>
          </figure>
        ))}
      </div>
    </Panel>
  );
}
