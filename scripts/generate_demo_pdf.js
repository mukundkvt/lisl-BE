import { generateDemoPdf } from "../utils/generateDevPdf.js";

generateDemoPdf().then(() => {
  console.log("Finished running generateDemoPdf.");
}).catch((err) => {
  console.error(err);
});
