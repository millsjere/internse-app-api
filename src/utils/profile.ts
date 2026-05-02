export const calculateProfileCompletion = (user: any): number => {
  let completion = 0;
  const fields = ['firstname', 'lastname', 'email', 'phone', 'bio'];
  const optionalFields = ['profilePhoto', 'resume', 'skills'];

  fields.forEach((field) => {
    if (user[field]) completion += 14;
  });

  optionalFields.forEach((field) => {
    if (user[field] && (Array.isArray(user[field]) ? user[field].length > 0 : true)) {
      completion += 5;
    }
  });

  if (user.experience && user.experience.length > 0) completion += 17;
  if (user.education && user.education.length > 0) completion += 17;

  return Math.min(completion, 100);
};

export const calculateCompanyProfileCompletion = (company: any): number => {
  let completion = 0;
  const fields = ['companyName', 'email', 'industry', 'website'];
  const optionalFields = ['phone', 'address', 'description', 'logo'];

  fields.forEach((field) => {
    if (company[field]) completion += 15;
  });

  optionalFields.forEach((field) => {
    if (company[field]) completion += 10;
  });

  return Math.min(completion, 100);
};
