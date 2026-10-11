from allauth.socialaccount.forms import SignupForm


class SocialSignupForm(SignupForm):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        username_field = self.fields.get(
            "username",
        )

        if username_field is not None:
            username_field.initial = ""

            username_field.widget.attrs.update(
                {
                    "placeholder": "Choose your public handle",
                    "autocomplete": "username",
                    "autofocus": True,
                }
            )

        email_field = self.fields.get(
            "email",
        )

        if email_field is not None:
            email_field.widget.attrs.update(
                {
                    "placeholder": "you@example.com",
                    "autocomplete": "email",
                }
            )
