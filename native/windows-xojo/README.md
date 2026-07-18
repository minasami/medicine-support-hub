# Windows desktop wrapper with Xojo

Create a 64-bit Xojo Desktop project named **Medicine Support Hub**.

## Window

- Add one `DesktopHTMLViewer` filling the window.
- Initial URL: `https://medicinesupport.app/medicines?source=windows-xojo`.
- Minimum window size: 390 × 700.
- Enable resize and standard browser keyboard navigation.
- Use the platform logo for the application icon after generating the Windows `.ico` sizes in Xojo.

## Security boundary

The Xojo application is a browser shell, not a new backend:

- Do not embed Supabase service-role, Appwrite, Resend, Gemini, OpenAI, or xAI credentials.
- Let the production website manage authentication and authorization.
- Keep cookies inside the platform WebView profile and provide a visible sign-out path.
- Open non-`medicinesupport.app` links in the system browser.
- Do not cache patient or clinical pages for offline use.

## Distribution

1. Build Windows x86-64 Release.
2. Include the Microsoft Visual C++ runtime required by the selected Xojo release.
3. Code-sign the executable and installer with an organization certificate.
4. Package with the Xojo-recommended installer workflow.
5. Test on a clean Windows 10 and Windows 11 machine.
6. Publish checksums and version/release notes beside the installer.

The wrapper version should be independent from web releases because most interface updates arrive from the hosted PWA.
