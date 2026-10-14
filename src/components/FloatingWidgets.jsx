import { useState } from "react";
import WhatsAppButton from "./WhatsAppButton";
import ChatAssistant from "./ChatAssistant";
import "./FloatingWidgets.css";

export default function FloatingWidgets() {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <div className="renet-floating-widgets">
      {/* On small screens the chat panel is full width, so WhatsApp steps aside. */}
      <WhatsAppButton hidden={chatOpen} />
      <ChatAssistant open={chatOpen} onOpenChange={setChatOpen} />
    </div>
  );
}
