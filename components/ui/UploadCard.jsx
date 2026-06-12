export default function UploadCard({
  id,
  title,
  subtitle,
  triggerText,
  metaText,
  accept,
  multiple = true,
  onChange,
}) {
  return (
    <label className="upload-card" htmlFor={id}>
      <span className="upload-title">{title}</span>
      <span className="upload-subtitle">{subtitle}</span>
      <div className="upload-action-row">
        <span className="file-trigger">{triggerText}</span>
        <span className="file-meta">{metaText}</span>
      </div>
      <input className="file-input" id={id} type="file" multiple={multiple} accept={accept} onChange={onChange} />
    </label>
  );
}
