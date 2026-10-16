function extractNameParts(nameDetails) {
  if (!nameDetails || typeof nameDetails !== "string") {
    return { fullName: "", firstName: "", middleName: "", lastName: "" };
  }
  const parts = nameDetails.trim().split(/\s+/);
      let fullName = nameDetails;
      let firstName = "";
      let middleName = "";
      let lastName = "";
      if (parts.length > 0) {
        firstName = parts[0];
      }
      if (parts.length > 1) {
        lastName = parts[parts.length - 1];
      }
      if (parts.length > 2) {
        middleName = parts.slice(1, -1).join(" ");
      }
      return { fullName, firstName, middleName, lastName };
    }


export default extractNameParts