export default function PrimaryButton({ children, disabled = false, onClick }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}
