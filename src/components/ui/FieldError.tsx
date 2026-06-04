export function FieldError({ children }: { children?: string | null }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-sm text-red-400">
      {children}
    </p>
  );
}
