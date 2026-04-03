async function imagequery(
  {
    url
}
: {
  url: string
}) {
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching images:", error);
    throw error;
  }
}


export { imagequery };