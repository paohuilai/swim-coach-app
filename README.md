# Swim Coach App - National Team Management

This is a comprehensive management system for swim coaches, including athlete tracking, training plans, and national team coordination.

## Features
- **Athlete Management**: Profiles, performance tracking, and status history.
- **Training Plans**: Create and assign detailed workout plans.
- **National Team Command Center**: Task management, Gantt charts, and resource allocation.
- **Cross-Platform**: Available as Web App, Android App, and Windows Desktop App.

## Development

### Prerequisites
- Node.js >= 22
- Rust (for Tauri/Windows build)
- Android Studio (for Android build)

### Setup
```bash
npm install
npm run dev
```

### Build
- **Web**: `npm run build`
- **Android**: `npx cap open android`
- **Windows**: `npm run tauri build`

## License
MIT

