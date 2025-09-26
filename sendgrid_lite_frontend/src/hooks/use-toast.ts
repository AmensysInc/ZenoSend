type ToastArgs = {
    title?: string;
    description?: string;
    variant?: "default" | "destructive";
};

export function toast({ title, description, variant = "default" }: ToastArgs) {
    const msg = [title, description].filter(Boolean).join("\n");
    if (variant === "destructive") {
        console.error(msg);
    } else {
        console.log(msg);
    }
    // pop a simple alert so it's visible during dev
    if (msg) {
        // comment this out if you don't want the popup
        alert(msg);
    }
}
