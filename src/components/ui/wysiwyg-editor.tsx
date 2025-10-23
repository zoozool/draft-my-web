import { useEffect, useRef, useState } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $generateHtmlFromNodes, $generateNodesFromDOM } from '@lexical/html';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListItemNode, ListNode, INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND } from '@lexical/list';
import { LinkNode } from '@lexical/link';
import { ImageNode, $createImageNode } from './editor/ImageNode';
import { 
  FORMAT_TEXT_COMMAND, 
  UNDO_COMMAND,
  REDO_COMMAND,
  $getRoot,
  $insertNodes,
  COMMAND_PRIORITY_EDITOR,
  createCommand,
  LexicalCommand,
  EditorState,
  LexicalEditor
} from 'lexical';
import { Button } from './button';
import { Bold, Italic, List, ListOrdered, Undo, Redo, ImagePlus, Link2, Code } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './dialog';
import { Input } from './input';
import { Label } from './label';
import { Textarea } from './textarea';

interface WysiwygEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const INSERT_IMAGE_COMMAND: LexicalCommand<{ src: string; altText?: string }> = createCommand();

function ToolbarPlugin({ onImageClick, onUrlDialogOpen, onHtmlToggle, showHtml }: {
  onImageClick: () => void;
  onUrlDialogOpen: () => void;
  onHtmlToggle: () => void;
  showHtml: boolean;
}) {
  const [editor] = useLexicalComposerContext();
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  useEffect(() => {
    return editor.registerCommand(
      INSERT_IMAGE_COMMAND,
      (payload) => {
        const imageNode = $createImageNode(payload);
        $insertNodes([imageNode]);
        return true;
      },
      COMMAND_PRIORITY_EDITOR
    );
  }, [editor]);

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        // Track undo/redo based on update
        setCanUndo(true); // Simplified - will be enabled after first change
        setCanRedo(false);
      });
    });
  }, [editor]);

  return (
    <div className="border-b bg-muted/50 p-2 flex gap-1 flex-wrap">
      {!showHtml && (
        <>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')}
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}
          >
            <Italic className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)}
          >
            <ListOrdered className="h-4 w-4" />
          </Button>
          <div className="w-px bg-border mx-1" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onImageClick}
          >
            <ImagePlus className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onUrlDialogOpen}
          >
            <Link2 className="h-4 w-4" />
          </Button>
          <div className="w-px bg-border mx-1" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
            disabled={!canUndo}
          >
            <Undo className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
            disabled={!canRedo}
          >
            <Redo className="h-4 w-4" />
          </Button>
          <div className="w-px bg-border mx-1" />
        </>
      )}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onHtmlToggle}
        className={showHtml ? 'bg-muted' : ''}
      >
        <Code className="h-4 w-4" />
      </Button>
    </div>
  );
}

function InitialContentPlugin({ initialValue }: { initialValue: string }) {
  const [editor] = useLexicalComposerContext();
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (!isInitialized && initialValue) {
      editor.update(() => {
        const parser = new DOMParser();
        const dom = parser.parseFromString(initialValue, 'text/html');
        const nodes = $generateNodesFromDOM(editor, dom);
        const root = $getRoot();
        root.clear();
        root.append(...nodes);
      });
      setIsInitialized(true);
    }
  }, [editor, initialValue, isInitialized]);

  return null;
}

export const WysiwygEditor = ({ value, onChange, placeholder, className }: WysiwygEditorProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUrlDialogOpen, setIsUrlDialogOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [showHtml, setShowHtml] = useState(false);
  const [htmlContent, setHtmlContent] = useState('');
  const [editor, setEditor] = useState<any>(null);

  const initialConfig = {
    namespace: 'WysiwygEditor',
    theme: {
      paragraph: 'mb-2',
      list: {
        nested: {
          listitem: 'list-none'
        },
        ol: 'list-decimal ml-4',
        ul: 'list-disc ml-4',
        listitem: 'mb-1'
      },
      link: 'text-primary underline',
      text: {
        bold: 'font-bold',
        italic: 'italic',
        underline: 'underline'
      }
    },
    onError: (error: Error) => {
      console.error(error);
    },
    nodes: [
      HeadingNode,
      ListNode,
      ListItemNode,
      QuoteNode,
      LinkNode,
      ImageNode
    ]
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !editor) return;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `email-images/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('campaign-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('campaign-images')
        .getPublicUrl(filePath);

      editor.dispatchCommand(INSERT_IMAGE_COMMAND, { src: publicUrl });

      toast({
        title: "Image uploaded",
        description: "Image has been added to the email template",
      });
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAddImageUrl = () => {
    if (imageUrl && editor) {
      editor.dispatchCommand(INSERT_IMAGE_COMMAND, { src: imageUrl });
      setImageUrl('');
      setIsUrlDialogOpen(false);
      toast({
        title: "Image added",
        description: "Image has been added to the email template",
      });
    }
  };

  const toggleHtmlView = () => {
    if (!editor) return;

    if (!showHtml) {
      editor.getEditorState().read(() => {
        const html = $generateHtmlFromNodes(editor);
        setHtmlContent(html);
      });
      setShowHtml(true);
    } else {
      editor.update(() => {
        const parser = new DOMParser();
        const dom = parser.parseFromString(htmlContent, 'text/html');
        const nodes = $generateNodesFromDOM(editor, dom);
        const root = $getRoot();
        root.clear();
        root.append(...nodes);
      });
      onChange(htmlContent);
      setShowHtml(false);
    }
  };

  const handleEditorChange = (editorState: EditorState, editor: any) => {
    if (!editor) setEditor(editor);
    
    editorState.read(() => {
      const html = $generateHtmlFromNodes(editor);
      onChange(html);
    });
  };

  return (
    <>
      <div className="border rounded-md">
        <LexicalComposer initialConfig={initialConfig}>
          <ToolbarPlugin
            onImageClick={() => fileInputRef.current?.click()}
            onUrlDialogOpen={() => setIsUrlDialogOpen(true)}
            onHtmlToggle={toggleHtmlView}
            showHtml={showHtml}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
          {showHtml ? (
            <Textarea
              value={htmlContent}
              onChange={(e) => setHtmlContent(e.target.value)}
              className="min-h-[200px] font-mono text-sm border-0 rounded-none"
              placeholder="Edit HTML..."
            />
          ) : (
            <div className="relative">
              <RichTextPlugin
                contentEditable={
                  <ContentEditable
                    className={cn(
                      'min-h-[200px] px-3 py-2 outline-none',
                      className
                    )}
                  />
                }
                placeholder={
                  <div className="absolute top-2 left-3 text-muted-foreground pointer-events-none">
                    {placeholder || 'Start typing...'}
                  </div>
                }
                ErrorBoundary={LexicalErrorBoundary}
              />
              <HistoryPlugin />
              <ListPlugin />
              <LinkPlugin />
              <OnChangePlugin onChange={handleEditorChange} />
              <InitialContentPlugin initialValue={value} />
            </div>
          )}
        </LexicalComposer>
      </div>

      <Dialog open={isUrlDialogOpen} onOpenChange={setIsUrlDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Image from URL</DialogTitle>
            <DialogDescription>
              Enter the URL of the image you want to add to your email template
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="image-url">Image URL</Label>
              <Input
                id="image-url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddImageUrl();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUrlDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddImageUrl}>Add Image</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
