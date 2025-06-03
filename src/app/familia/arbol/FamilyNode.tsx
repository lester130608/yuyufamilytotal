import React from 'react'

interface FamilyNodeProps {
  name: string
  photoUrl?: string
  onClick?: () => void
  onPhotoChange?: (file: File) => void
}

export const FamilyNode: React.FC<FamilyNodeProps> = ({ name, photoUrl, onClick, onPhotoChange }) => {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const firstName = name.split(' ')[0] || name

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 120 }}>
      <div
        onClick={onClick}
        style={{
          width: 100,
          height: 100,
          borderRadius: '50%',
          border: '3px solid #cc0000',
          objectFit: 'cover',
          background: '#fff',
          boxShadow: '0 4px 16px #0002',
          overflow: 'hidden',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        <img
          src={photoUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}
          alt={firstName}
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            objectFit: 'cover',
          }}
        />
        {onPhotoChange && (
          <>
            <input
              type="file"
              accept="image/*"
              ref={inputRef}
              style={{ display: 'none' }}
              onChange={e => {
                if (e.target.files && e.target.files[0]) {
                  onPhotoChange(e.target.files[0])
                }
              }}
            />
            <button
              type="button"
              onClick={e => {
                e.stopPropagation()
                inputRef.current?.click()
              }}
              style={{
                position: 'absolute',
                bottom: 4,
                right: 4,
                background: '#fff',
                border: '1px solid #cc0000',
                borderRadius: '50%',
                width: 28,
                height: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                cursor: 'pointer',
                boxShadow: '0 1px 4px #0002',
                padding: 0,
              }}
              title="Subir foto"
            >📷</button>
          </>
        )}
      </div>
      <div
        style={{
          marginTop: 10,
          fontWeight: 700,
          fontSize: 16,
          color: '#222',
          background: 'transparent',
          borderRadius: 8,
          boxShadow: 'none',
          padding: '4px 12px',
          position: 'relative',
          top: -18,
          zIndex: 2,
          minWidth: 80,
          textAlign: 'center',
        }}
      >
        {firstName}
      </div>
    </div>
  )
}