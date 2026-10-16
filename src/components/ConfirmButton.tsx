"use client";

/** Botón que pide confirmación antes de ejecutar una Server Action. */
export function ConfirmButton({
  action,
  message,
  children,
}: {
  action: () => Promise<unknown>;
  message: string;
  children: React.ReactNode;
}) {
  return (
    <form
      action={async () => {
        await action();
      }}
      onSubmit={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      <button className="btn-danger">{children}</button>
    </form>
  );
}
