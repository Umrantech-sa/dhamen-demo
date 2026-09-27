// Anything not in the guide's service list → "No Mapping Rule matched".
const notFound = () => Response.json({ messageCode: "404", messageDescription: "Not Found: No Mapping Rule matched" }, { status: 404 });
export { notFound as GET, notFound as POST, notFound as PUT, notFound as DELETE };
