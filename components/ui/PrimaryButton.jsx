export default function PrimaryButton({ children, className = "", disabled = false, onClick }) {
  return (
    <button type="button" className={className} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}
