import { useEffect, useRef, useState } from 'react'
import {
  XIcon,
  FlipHorizontalIcon,
  ZoomInIcon,
  ZoomOutIcon,
  RefreshCwIcon,
  CheckIcon,
} from './Icons'

const VIEWPORT_SIZE = 280 // px size of the crop viewport square/circle
const OUTPUT_SIZE = 500 // px size of the exported cropped file

/**
 * Interactive Profile Picture Cropper Modal with cover-fill, in-place flip, zoom, and live preview.
 */
export default function CropAvatarDialog({ imageSrc, originalFile, onCancel, onSave, saving }) {
  const [zoom, setZoom] = useState(1)
  const [flip, setFlip] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [imgElement, setImgElement] = useState(null)
  const [imageLoaded, setImageLoaded] = useState(false)

  const viewportRef = useRef(null)

  // Load image element into memory for drawing on canvas
  useEffect(() => {
    if (!imageSrc) return
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = imageSrc
    img.onload = () => {
      setImgElement(img)
      setImageLoaded(true)
    }
  }, [imageSrc])

  // Compute base dimensions so the image COVERS the circular viewport (fills edge-to-edge with no empty margins)
  let baseWidth = VIEWPORT_SIZE
  let baseHeight = VIEWPORT_SIZE
  if (imgElement && imgElement.naturalWidth && imgElement.naturalHeight) {
    const aspect = imgElement.naturalWidth / imgElement.naturalHeight
    if (aspect >= 1) {
      // Landscape: height fills the 280px circle, width expands proportionally
      baseHeight = VIEWPORT_SIZE
      baseWidth = VIEWPORT_SIZE * aspect
    } else {
      // Portrait: width fills the 280px circle, height expands proportionally
      baseWidth = VIEWPORT_SIZE
      baseHeight = VIEWPORT_SIZE / aspect
    }
  }

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !saving) onCancel()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onCancel, saving])

  // Mouse / Touch drag handlers
  const handleMouseDown = (e) => {
    e.preventDefault()
    setIsDragging(true)
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    setDragStart({ x: clientX - position.x, y: clientY - position.y })
  }

  const handleMouseMove = (e) => {
    if (!isDragging) return
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    setPosition({
      x: clientX - dragStart.x,
      y: clientY - dragStart.y,
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  // Wheel zoom handler
  const handleWheel = (e) => {
    e.preventDefault()
    const delta = e.deltaY < 0 ? 0.1 : -0.1
    setZoom((z) => Math.min(Math.max(1, z + delta), 3))
  }

  // In-place horizontal flip: keeps the cropped focal point locked in the center
  const handleToggleFlip = () => {
    setFlip((f) => !f)
    setPosition((pos) => ({ ...pos, x: -pos.x }))
  }

  const handleReset = () => {
    setZoom(1)
    setFlip(false)
    setPosition({ x: 0, y: 0 })
  }

  const handleExportAndSave = () => {
    if (!imgElement) return

    const canvas = document.createElement('canvas')
    canvas.width = OUTPUT_SIZE
    canvas.height = OUTPUT_SIZE
    const ctx = canvas.getContext('2d')

    if (!ctx) return

    // Clean background
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE)

    const scaleRatio = OUTPUT_SIZE / VIEWPORT_SIZE

    ctx.save()

    // 1. Move to canvas center (circle center)
    ctx.translate(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2)

    // 2. Apply user pan position
    ctx.translate(position.x * scaleRatio, position.y * scaleRatio)

    // 3. Mirror horizontally across image center
    ctx.scale(flip ? -1 : 1, 1)

    // 4. Draw image scaled to cover the crop circle
    const drawW = baseWidth * zoom * scaleRatio
    const drawH = baseHeight * zoom * scaleRatio

    ctx.drawImage(imgElement, -drawW / 2, -drawH / 2, drawW, drawH)
    ctx.restore()

    // Convert to file blob
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        const filename = originalFile?.name ? originalFile.name.replace(/\.[^/.]+$/, '.jpg') : 'profile-picture.jpg'
        const croppedFile = new File([blob], filename, { type: 'image/jpeg' })
        onSave(croppedFile)
      },
      'image/jpeg',
      0.92
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/60 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto"
      onClick={(e) => e.target === e.currentTarget && !saving && onCancel()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="crop-dialog-title"
        className="relative w-full max-w-[500px] rounded-3xl border border-line bg-white p-6 sm:p-8 shadow-2xl transition-all"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-line">
          <div>
            <h2 id="crop-dialog-title" className="text-[20px] font-bold text-navy-900">
              Crop & Adjust Profile Picture
            </h2>
            <p className="text-[13px] text-muted mt-0.5">
              Drag to reposition, zoom or flip your picture.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="flex size-9 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-navy-900 transition disabled:opacity-50"
            aria-label="Close"
          >
            <XIcon className="size-5" />
          </button>
        </div>

        {/* Viewport Workspace */}
        <div className="mt-6 flex flex-col items-center">
          <div
            ref={viewportRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleMouseDown}
            onTouchMove={handleMouseMove}
            onTouchEnd={handleMouseUp}
            onWheel={handleWheel}
            style={{ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE }}
            className={`relative rounded-full overflow-hidden border-4 border-white shadow-xl ring-1 ring-line select-none touch-none ${
              isDragging ? 'cursor-grabbing' : 'cursor-grab'
            } bg-slate-900/5`}
          >
            {/* Dark circular overlay / ring border */}
            <div className="absolute inset-0 z-10 pointer-events-none rounded-full ring-1 ring-black/10 shadow-inner" />

            {/* Rendered Live Image */}
            {imageSrc && (
              <div
                className="w-full h-full flex items-center justify-center pointer-events-none"
                style={{
                  transform: `translate(${position.x}px, ${position.y}px)`,
                }}
              >
                <img
                  src={imageSrc}
                  alt="Crop preview"
                  draggable={false}
                  style={{
                    width: `${baseWidth}px`,
                    height: `${baseHeight}px`,
                    transform: `scale(${flip ? -1 : 1}, 1) scale(${zoom})`,
                    transformOrigin: 'center center',
                  }}
                  className="max-w-none max-h-none transition-transform duration-75"
                />
              </div>
            )}
          </div>

          <span className="mt-2.5 text-[12px] font-medium text-slate-400">
            Scroll or drag to adjust viewport position
          </span>
        </div>

        {/* Tools & Controls Toolbar */}
        <div className="mt-6 space-y-4 rounded-2xl bg-slate-50 border border-slate-200/80 p-4">
          {/* Zoom Slider */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(1, z - 0.1))}
              className="p-1.5 text-navy-900 hover:bg-white rounded-lg transition border border-transparent hover:border-slate-200"
              title="Zoom Out"
            >
              <ZoomOutIcon className="size-4" />
            </button>

            <input
              type="range"
              min="1"
              max="3"
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="flex-1 accent-brand-500 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
            />

            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(3, z + 0.1))}
              className="p-1.5 text-navy-900 hover:bg-white rounded-lg transition border border-transparent hover:border-slate-200"
              title="Zoom In"
            >
              <ZoomInIcon className="size-4" />
            </button>

            <span className="min-w-[42px] text-right font-mono text-[12px] font-semibold text-navy-900">
              {Math.round(zoom * 100)}%
            </span>
          </div>

          {/* Transform Action Buttons (Flip, Reset) */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/60">
            {/* Flip Button */}
            <button
              type="button"
              onClick={handleToggleFlip}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border text-[13px] font-semibold shadow-2xs transition ${
                flip
                  ? 'border-brand-500 bg-brand-50 text-brand-600'
                  : 'border-line bg-white text-navy-900 hover:bg-slate-100'
              }`}
              title="Flip Photo Horizontally"
            >
              <FlipHorizontalIcon className="size-4" />
              <span>Flip</span>
            </button>

            {/* Reset */}
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-line bg-white text-[13px] font-semibold text-slate-600 hover:text-navy-900 hover:bg-slate-100 transition shadow-2xs"
              title="Reset All Adjustments"
            >
              <RefreshCwIcon className="size-4" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Footer Dialog Actions */}
        <div className="mt-7 flex items-center justify-end gap-3 pt-4 border-t border-line">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-xl border border-line px-5 py-2.5 text-[14px] font-medium text-ink transition hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExportAndSave}
            disabled={saving || !imageLoaded}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-6 py-2.5 text-[14px] font-semibold text-white shadow-sm transition hover:bg-brand-600 disabled:opacity-60"
          >
            {saving ? (
              'Uploading…'
            ) : (
              <>
                <CheckIcon className="size-4" />
                Save & Upload
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
