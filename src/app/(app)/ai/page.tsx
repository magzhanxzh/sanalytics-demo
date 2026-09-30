import { AppHeader } from "@/components/AppHeader";
import { AiChat } from "@/components/AiChat";

export default function Page() {
  return (
    <>
      <AppHeader title="AI analyst" subtitle="Answers questions about your data" />
      <div style={{ padding: "22px 28px 60px" }}>
        <AiChat />
      </div>
    </>
  );
}
