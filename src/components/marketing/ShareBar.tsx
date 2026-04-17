import { Button } from "@/components/ui/button";
import { Download, MessageCircle, Facebook, Linkedin, Twitter, Send, Copy } from "lucide-react";
import { toast } from "sonner";
import * as htmlToImage from "html-to-image";
import {
  shareWhatsApp, shareFacebook, shareTwitter, shareLinkedIn, shareTelegram,
} from "@/lib/marketing";
import { useRef } from "react";

interface Props {
  targetRef: React.RefObject<HTMLElement | null>;
  shareText: string;
  shareUrl: string;
  filename?: string;
  onShared?: () => void;
  onDownloaded?: () => void;
}

export function ShareBar({ targetRef, shareText, shareUrl, filename = "leadmines-post.png", onShared, onDownloaded }: Props) {
  const busy = useRef(false);

  const snapshot = async (): Promise<string | null> => {
    if (!targetRef.current) return null;
    try {
      return await htmlToImage.toPng(targetRef.current, {
        cacheBust: true,
        pixelRatio: 1,
        skipFonts: false,
      });
    } catch (e: any) {
      toast.error("Couldn't render image", { description: e.message });
      return null;
    }
  };

  const handleDownload = async () => {
    if (busy.current) return;
    busy.current = true;
    const png = await snapshot();
    busy.current = false;
    if (!png) return;
    const a = document.createElement("a");
    a.href = png;
    a.download = filename;
    a.click();
    toast.success("Downloaded");
    onDownloaded?.();
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  const wrap = (fn: () => void) => () => { fn(); onShared?.(); };

  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={handleDownload} className="gap-2"><Download className="size-4" /> Download PNG</Button>
      <Button variant="outline" onClick={wrap(() => shareWhatsApp(shareText))} className="gap-2 text-emerald-600">
        <MessageCircle className="size-4" /> WhatsApp
      </Button>
      <Button variant="outline" onClick={wrap(() => shareFacebook(shareUrl, shareText))} className="gap-2 text-blue-600">
        <Facebook className="size-4" /> Facebook
      </Button>
      <Button variant="outline" onClick={wrap(() => shareLinkedIn(shareUrl))} className="gap-2 text-sky-700">
        <Linkedin className="size-4" /> LinkedIn
      </Button>
      <Button variant="outline" onClick={wrap(() => shareTwitter(shareText, shareUrl))} className="gap-2">
        <Twitter className="size-4" /> X
      </Button>
      <Button variant="outline" onClick={wrap(() => shareTelegram(shareText, shareUrl))} className="gap-2">
        <Send className="size-4" /> Telegram
      </Button>
      <Button variant="ghost" onClick={copyLink} className="gap-2"><Copy className="size-4" /> Copy link</Button>
    </div>
  );
}
