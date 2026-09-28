const stages = document.querySelectorAll(".stage");
const searchQuery = document.querySelector(".search-query");
let activeEditor = null;

function finishEditing(editor) {
    if (!editor || !editor.isContentEditable) {
        return;
    }

    editor.contentEditable = "false";
    editor.setAttribute("role", "button");
    editor.setAttribute("aria-label", "Clique para editar o texto do quadro");
    editor.removeAttribute("aria-multiline");
    editor.classList.remove("is-editing");

    if (activeEditor === editor) {
        activeEditor = null;
    }
}

function startEditing(editor) {
    if (activeEditor === editor) {
        return;
    }

    finishEditing(activeEditor);
    activeEditor = editor;
    editor.contentEditable = "true";
    editor.setAttribute("role", "textbox");
    editor.setAttribute("aria-label", "Editando o texto do quadro");
    editor.setAttribute("aria-multiline", "true");
    editor.classList.add("is-editing");
    editor.focus();
}

function configureEditor(editor, activationTarget, isStage = false) {
    editor.classList.add("stage-copy");
    editor.contentEditable = "false";
    editor.tabIndex = 0;
    editor.setAttribute("role", "button");
    editor.setAttribute("aria-label", "Clique para editar o texto do quadro");

    activationTarget.addEventListener("click", (event) => {
        if (!isStage || !event.target.closest(".side-arrow")) {
            startEditing(editor);
        }
    });

    editor.addEventListener("keydown", (event) => {
        if (!editor.isContentEditable && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            startEditing(editor);
        } else if (editor.isContentEditable && event.key === "Escape") {
            event.preventDefault();
            editor.blur();
        }
    });

    editor.addEventListener("blur", () => finishEditing(editor));
}

stages.forEach((stage) => {
    const editor = Array.from(stage.children).find(
        (child) => !child.classList.contains("side-arrow"),
    );

    if (editor) {
        configureEditor(editor, stage, true);
    }
});

if (searchQuery) {
    configureEditor(searchQuery, searchQuery);
}

const downloadButton = document.querySelector("#download-prisma");
const downloadStatus = document.querySelector("#download-status");

downloadButton?.addEventListener("click", async () => {
    const originalLabel = downloadButton.querySelector("span").textContent;
    downloadButton.disabled = true;
    downloadButton.querySelector("span").textContent = "Gerando imagem...";
    downloadStatus.textContent = "Gerando a imagem do fluxograma.";

    try {
        if (typeof window.html2canvas !== "function") {
            throw new Error("A biblioteca de captura não foi carregada.");
        }

        await document.fonts.ready;

        const flowSection = document.querySelector("#prisma-flow");
        const flowRect = flowSection.getBoundingClientRect();
        const phaseLabels = Array.from(document.querySelectorAll(".phase")).map((phase) => {
            const style = getComputedStyle(phase);
            const rect = phase.getBoundingClientRect();
            return {
                text: phase.textContent.trim().toUpperCase(),
                left: rect.left - flowRect.left,
                top: rect.top - flowRect.top,
                width: rect.width,
                height: rect.height,
                color: style.color,
                fontWeight: style.fontWeight,
                fontFamily: style.fontFamily,
                fontSize: parseFloat(style.fontSize),
                letterSpacing: parseFloat(style.letterSpacing) || 0,
            };
        });

        const renderedCanvas = await window.html2canvas(flowSection, {
            backgroundColor: "#ffffff",
            scale: 2,
            useCORS: true,
            logging: false,
            onclone: (clonedDocument) => {
                clonedDocument.querySelectorAll(".phase").forEach((phase, index) => {
                    phase.style.height = `${phaseLabels[index].height}px`;
                    phase.replaceChildren();
                });
            },
        });

        const canvas = document.createElement("canvas");
        canvas.width = renderedCanvas.width;
        canvas.height = renderedCanvas.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(renderedCanvas, 0, 0);
        const pixelScale = canvas.width / flowRect.width;

        phaseLabels.forEach(({ text, left, top, width, height, color, fontWeight, fontFamily, fontSize, letterSpacing }) => {
            const cx = (left + width / 2) * pixelScale;
            const cy = (top + height / 2) * pixelScale;
            const scaledFontSize = fontSize * pixelScale;
            const scaledSpacing = letterSpacing * pixelScale;

            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(-Math.PI / 2);
            ctx.fillStyle = color;
            ctx.font = `${fontWeight} ${scaledFontSize}px ${fontFamily}`;
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";

            const chars = Array.from(text);
            const widths = chars.map((char) => ctx.measureText(char).width);
            const totalWidth = widths.reduce((sum, w) => sum + w, 0) + scaledSpacing * (chars.length - 1);

            let x = -totalWidth / 2;
            chars.forEach((char, index) => {
                ctx.fillText(char, x, 0);
                x += widths[index] + scaledSpacing;
            });

            ctx.restore();
        });

        const imageBlob = await new Promise((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error("Não foi possível gerar o arquivo PNG."));
                }
            }, "image/png");
        });

        const imageUrl = URL.createObjectURL(imageBlob);
        const downloadLink = document.createElement("a");
        downloadLink.href = imageUrl;
        downloadLink.download = "protocolo-prisma.png";
        downloadLink.click();
        URL.revokeObjectURL(imageUrl);
        downloadStatus.textContent = "Imagem do fluxograma baixada.";
    } catch (error) {
        console.error("Falha ao exportar o fluxograma:", error);
        downloadStatus.textContent = "Não foi possível gerar a imagem. Tente novamente.";
    } finally {
        downloadButton.disabled = false;
        downloadButton.querySelector("span").textContent = originalLabel;
    }
});
