import { AppHeader } from "@/components/AppHeader";
import { AiChat } from "@/components/AiChat";

export default function Page() {
  return (
    <>
      <AppHeader title="ИИ-аналитик" subtitle="Отвечает на вопросы по вашим данным" />
      <div style={{ padding: "22px 28px 60px" }}>
        <AiChat />
      </div>
    </>
  );
}
